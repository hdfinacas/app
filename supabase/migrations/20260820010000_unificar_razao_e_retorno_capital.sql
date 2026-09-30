-- Fonte única de verdade para caixa, principal devolvido, juros e encargos.
-- A migração é aditiva e idempotente: não remove nem reduz valores existentes.

ALTER TABLE public.contract_installments
  ADD COLUMN IF NOT EXISTS scheduled_principal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_interest numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_principal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_interest numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_fees numeric NOT NULL DEFAULT 0;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS principal_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investor_loan_id uuid REFERENCES public.investor_loans(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_investor_capital
ON public.transactions(investor_loan_id) WHERE investor_loan_id IS NOT NULL;

-- Reconstrói a composição prevista das parcelas antigas. O capital distribuído
-- fecha exatamente no capital do contrato; centavos residuais vão para a última.
DO $$
DECLARE
  c record;
  i record;
  positive_count integer;
  positive_index integer;
  principal_left numeric;
  principal_part numeric;
  interest_part numeric;
BEGIN
  FOR c IN
    SELECT id, capital, interest_rate, loan_mode
    FROM public.contracts
  LOOP
    SELECT count(*) INTO positive_count
    FROM public.contract_installments
    WHERE contract_id = c.id AND amount > 0;

    principal_left := round(coalesce(c.capital, 0)::numeric, 2);
    positive_index := 0;

    FOR i IN
      SELECT id, amount, installment_number
      FROM public.contract_installments
      WHERE contract_id = c.id
      ORDER BY installment_number, id
    LOOP
      IF i.amount <= 0 OR positive_count = 0 THEN
        principal_part := 0;
        interest_part := 0;
      ELSE
        positive_index := positive_index + 1;
        IF c.loan_mode = 'interest_only' THEN
          principal_part := CASE WHEN positive_index = positive_count THEN principal_left ELSE 0 END;
        ELSIF c.loan_mode = 'bullet' THEN
          principal_part := principal_left;
        ELSIF c.loan_mode = 'price' THEN
          principal_part := least(
            principal_left,
            greatest(0, round((i.amount - principal_left * coalesce(c.interest_rate, 0) / 100)::numeric, 2))
          );
          IF positive_index = positive_count THEN principal_part := principal_left; END IF;
        ELSE
          principal_part := CASE
            WHEN positive_index = positive_count THEN principal_left
            ELSE least(principal_left, round((coalesce(c.capital, 0) / positive_count)::numeric, 2))
          END;
        END IF;

        interest_part := round((i.amount - principal_part)::numeric, 2);
        principal_left := round(greatest(0, principal_left - principal_part)::numeric, 2);
      END IF;

      UPDATE public.contract_installments
      SET scheduled_principal = principal_part,
          scheduled_interest = interest_part
      WHERE id = i.id;
    END LOOP;
  END LOOP;
END;
$$;

-- O RPC de criação aceita JSON e versões antigas ignoram campos novos do
-- payload. Este gatilho recalcula o contrato inteiro após a inserção em lote,
-- mantendo criação via UI, importação e API com a mesma composição.
CREATE OR REPLACE FUNCTION public.refresh_new_contract_amortization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c record; i record; qty integer; pos integer; left_principal numeric; part numeric;
BEGIN
  FOR c IN SELECT ct.id,ct.capital,ct.interest_rate,ct.loan_mode
    FROM public.contracts ct JOIN (SELECT DISTINCT contract_id FROM new_installments) n ON n.contract_id=ct.id
  LOOP
    SELECT count(*) INTO qty FROM public.contract_installments WHERE contract_id=c.id AND amount>0;
    pos:=0; left_principal:=round(coalesce(c.capital,0)::numeric,2);
    FOR i IN SELECT id,amount FROM public.contract_installments WHERE contract_id=c.id ORDER BY installment_number,id
    LOOP
      IF i.amount<=0 OR qty=0 THEN part:=0;
      ELSE
        pos:=pos+1;
        IF c.loan_mode='interest_only' THEN part:=CASE WHEN pos=qty THEN left_principal ELSE 0 END;
        ELSIF c.loan_mode='bullet' THEN part:=left_principal;
        ELSIF c.loan_mode='price' THEN
          part:=least(left_principal,greatest(0,round(i.amount-left_principal*coalesce(c.interest_rate,0)/100,2)));
          IF pos=qty THEN part:=left_principal; END IF;
        ELSE part:=CASE WHEN pos=qty THEN left_principal ELSE least(left_principal,round(c.capital/qty,2)) END;
        END IF;
        left_principal:=round(greatest(0,left_principal-part),2);
      END IF;
      UPDATE public.contract_installments SET scheduled_principal=part,
        scheduled_interest=round(i.amount-part,2) WHERE id=i.id;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_refresh_new_contract_amortization ON public.contract_installments;
CREATE TRIGGER trg_refresh_new_contract_amortization
AFTER INSERT ON public.contract_installments REFERENCING NEW TABLE AS new_installments
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_new_contract_amortization();

-- Preenche a composição cumulativa já recebida, sem criar dinheiro novo.
UPDATE public.contract_installments i
SET paid_principal = round((i.scheduled_principal * least(coalesce(i.paid_amount, 0), i.amount)
                            / nullif(i.amount, 0))::numeric, 2),
    paid_interest = round((least(coalesce(i.paid_amount, 0), i.amount)
                           - i.scheduled_principal * least(coalesce(i.paid_amount, 0), i.amount)
                             / nullif(i.amount, 0))::numeric, 2),
    paid_fees = round(greatest(0, coalesce(i.paid_amount, 0) - i.amount)::numeric, 2)
WHERE i.amount > 0 AND coalesce(i.paid_amount, 0) > 0;

-- Todo contrato representa uma saída real da carteira no momento da liberação.
CREATE OR REPLACE FUNCTION public.record_contract_disbursement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cash numeric;
BEGIN
  _cash := CASE
    WHEN coalesce(NEW.notes, '') LIKE 'Renegociação do contrato%'
      THEN coalesce(nullif(substring(NEW.notes from '\[cash_disbursed:([0-9]+(\.[0-9]+)?)\]'), '')::numeric, 0)
    ELSE round(NEW.capital::numeric, 2)
  END;
  IF _cash <= 0 THEN RETURN NEW; END IF;
  INSERT INTO public.transactions
    (user_id, type, category, description, amount, date, contract_id, client_id,
     principal_amount, source_key)
  VALUES
    (NEW.user_id, 'loan_disbursement', 'loan_disbursement', 'Empréstimo liberado',
     _cash, coalesce(NEW.created_at, now()), NEW.id, NEW.client_id,
     _cash, 'loan-disbursement:' || NEW.id::text)
  ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_contract_disbursement ON public.contracts;
CREATE TRIGGER trg_record_contract_disbursement
AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.record_contract_disbursement();

INSERT INTO public.transactions
  (user_id, type, category, description, amount, date, contract_id, client_id,
   principal_amount, source_key)
SELECT c.user_id, 'loan_disbursement', 'loan_disbursement', 'Empréstimo liberado',
       x.cash, coalesce(c.created_at, now()), c.id, c.client_id,
       x.cash, 'loan-disbursement:' || c.id::text
FROM public.contracts c
JOIN LATERAL (SELECT CASE WHEN coalesce(c.notes,'') LIKE 'Renegociação do contrato%'
  THEN coalesce((SELECT sum(t.amount) FROM public.transactions t
    WHERE t.contract_id=c.id AND t.user_id=c.user_id AND t.type='loan'),0)
  ELSE round(c.capital::numeric,2) END AS cash) x ON x.cash > 0
ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;

-- Garante um lançamento de entrada para parcelas antigas que foram quitadas
-- antes da criação do razão atômico.
INSERT INTO public.transactions
  (user_id, type, category, description, amount, date, contract_id, client_id,
   installment_id, principal_amount, interest_amount, fee_amount, source_key)
SELECT i.user_id, 'payment', 'installment_payment',
       'Pagamento parcela #' || i.installment_number,
       round(coalesce(i.paid_amount, i.amount)::numeric, 2), coalesce(i.paid_at, i.created_at),
       i.contract_id, i.client_id, i.id, i.paid_principal, i.paid_interest, i.paid_fees,
       'legacy-payment:' || i.id::text
FROM public.contract_installments i
WHERE i.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = i.user_id AND t.installment_id = i.id AND t.type = 'payment'
  )
ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;

-- Pagamento atômico: parcela, composição, lucro, razão e conclusão do contrato.
CREATE OR REPLACE FUNCTION public.pay_installment(
  _installment_id uuid,
  _paid_total numeric,
  _mark_paid boolean DEFAULT true,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _prev_paid numeric;
  _new_money numeric;
  _contractual_paid numeric;
  _principal_total numeric;
  _interest_total numeric;
  _fees_total numeric;
  _new_principal numeric;
  _new_interest numeric;
  _new_fees numeric;
  _remaining integer;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments
  WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  _prev_paid := round(coalesce(_inst.paid_amount, 0)::numeric, 2);
  _paid_total := round(coalesce(_paid_total, 0)::numeric, 2);
  IF _paid_total < _prev_paid THEN RAISE EXCEPTION 'paid_total_cannot_decrease'; END IF;
  IF _paid_total <= 0 THEN RAISE EXCEPTION 'invalid_paid_total'; END IF;
  IF _mark_paid AND _paid_total < round(_inst.amount::numeric, 2) THEN
    RAISE EXCEPTION 'payment_below_installment_amount';
  END IF;
  IF _inst.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'new_money', 0);
  END IF;

  _new_money := round((_paid_total - _prev_paid)::numeric, 2);
  _contractual_paid := least(_paid_total, round(_inst.amount::numeric, 2));
  _principal_total := CASE WHEN _inst.amount > 0
    THEN round((_inst.scheduled_principal * _contractual_paid / _inst.amount)::numeric, 2)
    ELSE 0 END;
  _interest_total := round((_contractual_paid - _principal_total)::numeric, 2);
  _fees_total := round(greatest(0, _paid_total - _inst.amount)::numeric, 2);
  _new_principal := round((_principal_total - coalesce(_inst.paid_principal, 0))::numeric, 2);
  _new_interest := round((_interest_total - coalesce(_inst.paid_interest, 0))::numeric, 2);
  _new_fees := round((_fees_total - coalesce(_inst.paid_fees, 0))::numeric, 2);

  UPDATE public.contract_installments
  SET paid_amount = _paid_total, paid_principal = _principal_total,
      paid_interest = _interest_total, paid_fees = _fees_total,
      payment_method = _method, receipt_url = coalesce(_receipt_url, receipt_url),
      receipt_review_status = CASE
        WHEN _mark_paid AND coalesce(_receipt_url, receipt_url) IS NOT NULL THEN 'approved'
        ELSE receipt_review_status END,
      status = CASE WHEN _mark_paid THEN 'paid' ELSE status END,
      paid_at = CASE WHEN _mark_paid THEN now() ELSE paid_at END
  WHERE id = _installment_id;

  IF _interest_total + _fees_total > 0 THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (auth.uid(), _interest_total + _fees_total,
            'Juros e encargos parcela #' || _inst.installment_number,
            _inst.client_id, _installment_id)
    ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL
    DO UPDATE SET amount = excluded.amount, description = excluded.description;
  END IF;

  IF _new_money > 0 THEN
    INSERT INTO public.transactions
      (user_id, amount, type, category, description, client_id, contract_id,
       installment_id, principal_amount, interest_amount, fee_amount)
    VALUES
      (auth.uid(), _new_money, 'payment', 'installment_payment',
       'Pagamento parcela #' || _inst.installment_number, _inst.client_id,
       _inst.contract_id, _installment_id, greatest(0, _new_principal),
       greatest(0, _new_interest), greatest(0, _new_fees));
  END IF;

  IF _mark_paid THEN
    SELECT count(*) INTO _remaining FROM public.contract_installments
    WHERE contract_id = _inst.contract_id AND status <> 'paid';
    IF _remaining = 0 THEN
      UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'new_money', _new_money, 'principal', _new_principal,
    'interest', _new_interest, 'fees', _new_fees
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_installment(uuid, numeric, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_installment(uuid, numeric, boolean, text, text) TO authenticated;

-- A quitação com desconto de encargos usa exatamente o mesmo motor contábil.
CREATE OR REPLACE FUNCTION public.pay_installment_waiving_fees(
  _installment_id uuid, _paid_total numeric, _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _inst public.contract_installments%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _inst FROM public.contract_installments
  WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF round(coalesce(_paid_total, 0)::numeric, 2) <> round(_inst.amount::numeric, 2) THEN
    RAISE EXCEPTION 'waived_payment_must_equal_installment_amount';
  END IF;
  UPDATE public.contract_installments SET late_fee = 0 WHERE id = _installment_id;
  RETURN public.pay_installment(_installment_id, _paid_total, true, _method, _receipt_url);
END;
$$;
REVOKE ALL ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) TO authenticated;

-- Estorno simétrico: remove apenas os lançamentos vinculados e zera também
-- a composição de principal/juros/encargos.
CREATE OR REPLACE FUNCTION public.reverse_installment_payment(_installment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE _inst public.contract_installments%rowtype;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments
  WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.profits WHERE installment_id = _installment_id AND user_id = auth.uid();
  DELETE FROM public.transactions WHERE installment_id = _installment_id AND user_id = auth.uid();
  UPDATE public.contract_installments
  SET status = 'pending', paid_at = NULL, paid_amount = NULL,
      paid_principal = 0, paid_interest = 0, paid_fees = 0,
      payment_method = NULL, receipt_review_status = 'none'
  WHERE id = _installment_id;
  UPDATE public.contracts SET status = 'active'
  WHERE id = _inst.contract_id AND status = 'completed';
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_installment_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_installment_payment(uuid) TO authenticated;

-- Mantém o portal do cobrador no mesmo razão. A autorização continua sendo
-- token + atribuição do cliente; a composição deixa de ser uma estimativa.
CREATE OR REPLACE FUNCTION public.collector_register_payment(
  _token text, _installment_id uuid, _paid_total numeric,
  _method text DEFAULT 'dinheiro', _receipt_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _tok public.collector_tokens%rowtype; _collector public.collectors%rowtype;
  _inst public.contract_installments%rowtype; _prev numeric; _new numeric;
  _contractual numeric; _principal numeric; _interest numeric; _fees numeric;
  _new_principal numeric; _new_interest numeric; _new_fees numeric; _remaining integer;
BEGIN
  SELECT * INTO _tok FROM public.collector_tokens
  WHERE token = btrim(coalesce(_token,'')) AND is_active LIMIT 1;
  IF _tok.id IS NULL THEN RAISE EXCEPTION 'token_invalido'; END IF;
  SELECT * INTO _collector FROM public.collectors WHERE id = _tok.collector_id;
  IF _collector.id IS NULL OR NOT _collector.is_active THEN RAISE EXCEPTION 'cobrador_inativo'; END IF;
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  IF _inst.user_id <> _tok.user_id THEN RAISE EXCEPTION 'parcela_de_outro_credor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.collector_assignments a
    WHERE a.collector_id = _tok.collector_id AND a.client_id = _inst.client_id
      AND a.user_id = _tok.user_id) THEN RAISE EXCEPTION 'cliente_nao_atribuido'; END IF;
  IF _inst.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'already_paid', true, 'new_money', 0); END IF;
  _prev := round(coalesce(_inst.paid_amount,0)::numeric,2);
  _paid_total := round(coalesce(_paid_total,0)::numeric,2);
  IF _paid_total < _inst.amount OR _paid_total < _prev THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  _new := _paid_total - _prev; _contractual := least(_paid_total, _inst.amount);
  _principal := CASE WHEN _inst.amount > 0 THEN round(_inst.scheduled_principal * _contractual / _inst.amount,2) ELSE 0 END;
  _interest := round(_contractual - _principal,2); _fees := round(greatest(0,_paid_total-_inst.amount),2);
  _new_principal := _principal-coalesce(_inst.paid_principal,0);
  _new_interest := _interest-coalesce(_inst.paid_interest,0); _new_fees := _fees-coalesce(_inst.paid_fees,0);
  UPDATE public.contract_installments SET paid_amount=_paid_total, paid_principal=_principal,
    paid_interest=_interest, paid_fees=_fees, payment_method=_method,
    receipt_url=coalesce(_receipt_url,receipt_url), status='paid', paid_at=now()
  WHERE id=_installment_id;
  IF _interest+_fees > 0 THEN
    INSERT INTO public.profits(user_id,amount,description,client_id,installment_id)
    VALUES(_tok.user_id,_interest+_fees,'Juros e encargos parcela #'||_inst.installment_number,
      _inst.client_id,_installment_id)
    ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL
    DO UPDATE SET amount=excluded.amount,description=excluded.description;
  END IF;
  INSERT INTO public.transactions(user_id,amount,type,category,description,client_id,contract_id,
    installment_id,principal_amount,interest_amount,fee_amount)
  VALUES(_tok.user_id,_new,'payment','installment_payment',
    'Pagamento parcela #'||_inst.installment_number||' recebido por '||_collector.name,
    _inst.client_id,_inst.contract_id,_installment_id,greatest(0,_new_principal),
    greatest(0,_new_interest),greatest(0,_new_fees));
  INSERT INTO public.collection_attempts(user_id,client_id,contract_id,installment_id,channel,message_preview)
  VALUES(_tok.user_id,_inst.client_id,_inst.contract_id,_installment_id,'manual',
    'Pagamento de '||_new::text||' via '||coalesce(_method,'-')||' por '||_collector.name);
  SELECT count(*) INTO _remaining FROM public.contract_installments
  WHERE contract_id=_inst.contract_id AND status<>'paid';
  IF _remaining=0 THEN UPDATE public.contracts SET status='completed' WHERE id=_inst.contract_id; END IF;
  RETURN jsonb_build_object('ok',true,'new_money',_new,'principal',_new_principal,
    'interest',_new_interest,'fees',_new_fees);
END;
$$;
REVOKE ALL ON FUNCTION public.collector_register_payment(text,uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collector_register_payment(text,uuid,numeric,text,text) TO anon, authenticated;

-- Renovação paga somente juros: classifica os lançamentos antigos e futuros
-- sem devolver principal artificialmente para a carteira.
UPDATE public.transactions SET interest_amount=amount, principal_amount=0, fee_amount=0
WHERE type='payment' AND category='interest_renewal' AND interest_amount=0;

CREATE OR REPLACE FUNCTION public.classify_financial_transaction()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type='payment' AND NEW.category='interest_renewal' THEN
    NEW.principal_amount:=0; NEW.interest_amount:=NEW.amount; NEW.fee_amount:=0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_classify_financial_transaction ON public.transactions;
CREATE TRIGGER trg_classify_financial_transaction BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.classify_financial_transaction();

-- Diagnóstico seguro e somente do próprio tenant. Não altera dados: permite
-- detectar imediatamente parcela, caixa ou lucro que ficaram divergentes.
CREATE OR REPLACE FUNCTION public.financial_reconciliation()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
WITH installment_ledger AS (
  SELECT i.id, i.contract_id, i.installment_number,
    round(coalesce(i.paid_amount,0)::numeric,2) AS paid,
    round(coalesce(sum(t.amount) FILTER (WHERE t.category IS DISTINCT FROM 'interest_renewal'),0)::numeric,2) AS ledger,
    round((coalesce(i.paid_interest,0)+coalesce(i.paid_fees,0))::numeric,2) AS expected_profit,
    round(coalesce((SELECT sum(p.amount) FROM public.profits p
      WHERE p.user_id=auth.uid() AND p.installment_id=i.id),0)::numeric,2) AS recorded_profit
  FROM public.contract_installments i
  LEFT JOIN public.transactions t ON t.installment_id=i.id AND t.user_id=auth.uid() AND t.type='payment'
  WHERE i.user_id=auth.uid()
  GROUP BY i.id
), anomalies AS (
  SELECT *, round(paid-ledger,2) AS cash_difference,
    round(expected_profit-recorded_profit,2) AS profit_difference
  FROM installment_ledger
  WHERE abs(paid-ledger)>0.01 OR abs(expected_profit-recorded_profit)>0.01
)
SELECT jsonb_build_object(
  'ok', NOT EXISTS(SELECT 1 FROM anomalies),
  'checked_installments', (SELECT count(*) FROM installment_ledger),
  'anomaly_count', (SELECT count(*) FROM anomalies),
  'anomalies', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY abs(a.cash_difference)+abs(a.profit_difference) DESC)
    FROM (SELECT * FROM anomalies LIMIT 20) a),'[]'::jsonb)
);
$$;
REVOKE ALL ON FUNCTION public.financial_reconciliation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financial_reconciliation() TO authenticated;

-- Capital captado entra na carteira; pagamentos ao investidor já saem pelo
-- fluxo register_investor_payment. Edição e exclusão permanecem sincronizadas.
CREATE OR REPLACE FUNCTION public.sync_investor_capital_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.transactions(user_id,type,category,description,amount,date,
    investor_loan_id,principal_amount,source_key)
  VALUES(NEW.user_id,'capital_injection','investor_capital','Capital recebido de investidor',
    round(NEW.principal::numeric,2),NEW.start_date::timestamptz,NEW.id,
    round(NEW.principal::numeric,2),'investor-capital:'||NEW.id::text)
  ON CONFLICT (investor_loan_id) WHERE investor_loan_id IS NOT NULL
  DO UPDATE SET amount=excluded.amount,principal_amount=excluded.principal_amount,
    date=excluded.date,user_id=excluded.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_investor_capital_transaction ON public.investor_loans;
CREATE TRIGGER trg_sync_investor_capital_transaction
AFTER INSERT OR UPDATE OF principal,start_date ON public.investor_loans
FOR EACH ROW EXECUTE FUNCTION public.sync_investor_capital_transaction();

INSERT INTO public.transactions(user_id,type,category,description,amount,date,
  investor_loan_id,principal_amount,source_key)
SELECT l.user_id,'capital_injection','investor_capital','Capital recebido de investidor',
  round(l.principal::numeric,2),l.start_date::timestamptz,l.id,
  round(l.principal::numeric,2),'investor-capital:'||l.id::text
FROM public.investor_loans l
ON CONFLICT (investor_loan_id) WHERE investor_loan_id IS NOT NULL
DO UPDATE SET amount=excluded.amount,principal_amount=excluded.principal_amount,date=excluded.date;
