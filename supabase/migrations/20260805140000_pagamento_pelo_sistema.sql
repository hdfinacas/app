BEGIN;

-- ============================================================================
-- Baixa de parcela feita pelo SISTEMA (bot do WhatsApp, automações).
--
-- `pay_installment` é SECURITY INVOKER e exige `auth.uid() = user_id` — correto
-- para as telas, mas inútil para uma edge function, que roda com service_role e
-- não tem `auth.uid()`. Sem uma alternativa, o whatsapp-webhook gravava
-- `.update({status:'paid'})` direto: a parcela era baixada e o pagamento NUNCA
-- chegava a `profits` nem a `transactions`.
--
-- Isso vale para o tenant que tem `bot_auto_confirm_payment` ligado — ou seja,
-- toda baixa automática por comprovante saía fora do razão.
--
-- Esta função faz a MESMA contabilidade, derivando o dono da própria parcela em
-- vez de `auth.uid()`. Só service_role executa: nenhum usuário do app alcança.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.system_register_payment(
  _installment_id uuid,
  _paid_total     numeric,
  _method         text DEFAULT 'pix',
  _origem         text DEFAULT 'sistema',
  _receipt_url    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inst      public.contract_installments%rowtype;
  _contract  public.contracts%rowtype;
  _prev_paid numeric;
  _new_money numeric;
  _interest  numeric := 0;
  _remaining int;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  IF _paid_total IS NULL OR _paid_total <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;

  _prev_paid := COALESCE(_inst.paid_amount, 0);
  _new_money := round((_paid_total - _prev_paid)::numeric, 2);

  UPDATE public.contract_installments
     SET paid_amount    = _paid_total,
         payment_method = _method,
         receipt_url    = COALESCE(_receipt_url, receipt_url),
         status         = 'paid',
         paid_at        = now()
   WHERE id = _installment_id;

  SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
  IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
    _interest := round((_inst.amount * (_contract.total_interest / _contract.total_amount))::numeric, 2);
  END IF;

  IF _interest > 0 THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (_inst.user_id, _interest,
            'Juros parcela #' || _inst.installment_number || ' (' || _origem || ')',
            _inst.client_id, _installment_id);
  END IF;

  IF _new_money > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, client_id, contract_id, installment_id)
    VALUES (_inst.user_id, _new_money, 'payment',
            'Pagamento parcela #' || _inst.installment_number || ' (' || _origem || ')',
            _inst.client_id, _inst.contract_id, _installment_id);
  END IF;

  SELECT count(*) INTO _remaining FROM public.contract_installments
   WHERE contract_id = _inst.contract_id AND status <> 'paid';
  IF _remaining = 0 THEN
    UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money, 'interest', _interest);
END;
$$;

-- Nenhum usuário do app pode chamar: é caminho de automação.
REVOKE ALL ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) TO service_role;

COMMIT;
