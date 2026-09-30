-- Atomic investor payments and interest-only renewals.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS investor_payment_id uuid REFERENCES public.investor_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_investor_payment
  ON public.transactions(investor_payment_id)
  WHERE investor_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_source_key
  ON public.transactions(user_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_investor_payment(
  _loan_id uuid,
  _amount numeric,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _loan public.investor_loans%rowtype;
  _payment_id uuid;
  _amount_rounded numeric;
  _new_paid numeric;
  _remaining numeric;
BEGIN
  SELECT * INTO _loan FROM public.investor_loans WHERE id = _loan_id FOR UPDATE;
  IF _loan.id IS NULL THEN RAISE EXCEPTION 'investor_loan_not_found'; END IF;
  IF _loan.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  _amount_rounded := round(coalesce(_amount, 0)::numeric, 2);
  _remaining := round(greatest(0, _loan.total_due - _loan.paid_amount)::numeric, 2);
  IF _amount_rounded <= 0 THEN RAISE EXCEPTION 'invalid_payment_amount'; END IF;
  IF _amount_rounded > _remaining THEN RAISE EXCEPTION 'payment_exceeds_balance'; END IF;

  INSERT INTO public.investor_payments
    (loan_id, investor_id, user_id, amount, method, receipt_url, notes)
  VALUES
    (_loan.id, _loan.investor_id, auth.uid(), _amount_rounded,
     nullif(_method, ''), nullif(_receipt_url, ''), nullif(_notes, ''))
  RETURNING id INTO _payment_id;

  _new_paid := round((_loan.paid_amount + _amount_rounded)::numeric, 2);
  UPDATE public.investor_loans
  SET paid_amount = _new_paid,
      status = CASE WHEN _new_paid >= total_due THEN 'paid' ELSE 'active' END,
      paid_at = CASE WHEN _new_paid >= total_due THEN now() ELSE NULL END,
      payment_method = nullif(_method, '')
  WHERE id = _loan.id;

  INSERT INTO public.transactions
    (user_id, type, category, description, amount, date, investor_payment_id)
  VALUES
    (auth.uid(), 'expense', 'investor_payment', 'Pagamento a investidor',
     _amount_rounded, now(), _payment_id);

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', _payment_id,
    'paid_amount', _new_paid,
    'remaining', greatest(0, _loan.total_due - _new_paid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_last_investor_payment(_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _loan public.investor_loans%rowtype;
  _payment public.investor_payments%rowtype;
  _new_paid numeric;
BEGIN
  SELECT * INTO _loan FROM public.investor_loans WHERE id = _loan_id FOR UPDATE;
  IF _loan.id IS NULL THEN RAISE EXCEPTION 'investor_loan_not_found'; END IF;
  IF _loan.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO _payment
  FROM public.investor_payments
  WHERE loan_id = _loan.id AND user_id = auth.uid()
  ORDER BY paid_at DESC, created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;
  IF _payment.id IS NULL THEN RAISE EXCEPTION 'investor_payment_not_found'; END IF;

  DELETE FROM public.transactions
  WHERE investor_payment_id = _payment.id AND user_id = auth.uid();
  DELETE FROM public.investor_payments WHERE id = _payment.id;

  SELECT round(coalesce(sum(amount), 0)::numeric, 2)
  INTO _new_paid
  FROM public.investor_payments
  WHERE loan_id = _loan.id;

  UPDATE public.investor_loans
  SET paid_amount = _new_paid,
      status = CASE WHEN _new_paid >= total_due THEN 'paid' ELSE 'active' END,
      paid_at = CASE WHEN _new_paid >= total_due THEN paid_at ELSE NULL END
  WHERE id = _loan.id;

  RETURN jsonb_build_object(
    'ok', true,
    'reversed_payment_id', _payment.id,
    'reversed_amount', _payment.amount,
    'paid_amount', _new_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_investor_payment(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_investor_payment(uuid, numeric, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reverse_last_investor_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_last_investor_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_renew_installment_interest(
  _installment_id uuid,
  _amount numeric,
  _next_due_date timestamptz,
  _origin text DEFAULT 'bot WhatsApp',
  _source_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _amount_rounded numeric;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _next_due_date IS NULL OR _next_due_date <= _inst.due_date THEN
    RAISE EXCEPTION 'invalid_next_due_date';
  END IF;
  _amount_rounded := round(coalesce(_amount, 0)::numeric, 2);
  IF _amount_rounded <= 0 THEN RAISE EXCEPTION 'invalid_payment_amount'; END IF;

  IF _source_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = _inst.user_id AND source_key = _source_key
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_applied', true);
  END IF;

  UPDATE public.contract_installments
  SET due_date = _next_due_date, late_fee = 0
  WHERE id = _inst.id;

  INSERT INTO public.transactions
    (user_id, amount, type, category, description, client_id, contract_id, installment_id, source_key)
  VALUES
    (_inst.user_id, _amount_rounded, 'payment', 'interest_renewal',
     'Renovação por pagamento de juros (' || coalesce(nullif(_origin, ''), 'sistema') || ')',
     _inst.client_id, _inst.contract_id, _inst.id, _source_key);

  INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
  VALUES (_inst.user_id, _amount_rounded, 'Juros de renovação', _inst.client_id, NULL);

  INSERT INTO public.audit_logs (user_id, entity_type, action, entity_id, details)
  VALUES (_inst.user_id, 'installment', 'interest_renewal', _inst.id,
          jsonb_build_object('amount', _amount_rounded, 'previous_due_date', _inst.due_date,
                             'next_due_date', _next_due_date, 'origin', _origin,
                             'source_key', _source_key));

  RETURN jsonb_build_object('ok', true, 'amount', _amount_rounded, 'next_due_date', _next_due_date);
END;
$$;

REVOKE ALL ON FUNCTION public.system_renew_installment_interest(uuid, numeric, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_renew_installment_interest(uuid, numeric, timestamptz, text, text)
  TO service_role;
