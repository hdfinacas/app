-- Distribui um recebimento entre as parcelas abertas mais antigas do cliente.
CREATE OR REPLACE FUNCTION public.pay_client_balance(
  _client_id uuid,
  _amount numeric,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _available numeric := round(coalesce(_amount, 0)::numeric, 2);
  _applied numeric := 0;
  _due numeric;
  _part numeric;
  _paid_count integer := 0;
  _partial_count integer := 0;
  _details jsonb := '[]'::jsonb;
BEGIN
  IF _available <= 0 THEN RAISE EXCEPTION 'invalid_payment_amount'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'client_not_found_or_forbidden'; END IF;

  FOR _inst IN
    SELECT * FROM public.contract_installments
    WHERE client_id = _client_id
      AND user_id = auth.uid()
      AND status NOT IN ('paid', 'cancelled')
    ORDER BY due_date, installment_number, created_at, id
    FOR UPDATE
  LOOP
    EXIT WHEN _available <= 0;
    _due := round(greatest(0,
      coalesce(_inst.amount, 0) + coalesce(_inst.late_fee, 0) - coalesce(_inst.paid_amount, 0)
    )::numeric, 2);
    IF _due <= 0 THEN CONTINUE; END IF;

    _part := least(_available, _due);
    PERFORM public.pay_installment(
      _inst.id,
      round((coalesce(_inst.paid_amount, 0) + _part)::numeric, 2),
      _part >= _due,
      _method,
      _receipt_url
    );

    IF _part >= _due THEN _paid_count := _paid_count + 1;
    ELSE _partial_count := _partial_count + 1;
    END IF;
    _details := _details || jsonb_build_array(jsonb_build_object(
      'installment_id', _inst.id,
      'installment_number', _inst.installment_number,
      'contract_id', _inst.contract_id,
      'amount', _part,
      'paid', _part >= _due
    ));
    _available := round((_available - _part)::numeric, 2);
    _applied := round((_applied + _part)::numeric, 2);
  END LOOP;

  IF _applied <= 0 THEN RAISE EXCEPTION 'no_open_installments'; END IF;
  IF _available > 0 THEN RAISE EXCEPTION 'payment_exceeds_client_balance'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'applied', _applied, 'remaining', _available,
    'paid_installments', _paid_count, 'partial_installments', _partial_count,
    'allocations', _details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_client_balance(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_client_balance(uuid, numeric, text, text) TO authenticated;

-- Distingue baixa de saldo de pagamento recorrente apenas dos juros do investidor.
ALTER TABLE public.investor_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'balance'
  CHECK (payment_type IN ('balance', 'interest_only'));

CREATE OR REPLACE FUNCTION public.register_investor_interest_payment(
  _loan_id uuid,
  _amount numeric,
  _next_due_date date,
  _method text DEFAULT 'pix',
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _loan public.investor_loans%rowtype;
  _payment_id uuid;
  _interest numeric;
BEGIN
  SELECT * INTO _loan FROM public.investor_loans WHERE id = _loan_id FOR UPDATE;
  IF _loan.id IS NULL THEN RAISE EXCEPTION 'investor_loan_not_found'; END IF;
  IF _loan.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _loan.status = 'paid' THEN RAISE EXCEPTION 'investor_loan_paid'; END IF;

  _interest := round((_loan.principal * _loan.interest_rate / 100)::numeric, 2);
  IF round(coalesce(_amount, 0)::numeric, 2) <> _interest OR _interest <= 0 THEN
    RAISE EXCEPTION 'invalid_interest_amount';
  END IF;
  IF _next_due_date IS NULL OR _next_due_date <= current_date THEN
    RAISE EXCEPTION 'invalid_next_due_date';
  END IF;

  INSERT INTO public.investor_payments
    (loan_id, investor_id, user_id, amount, method, notes, payment_type)
  VALUES
    (_loan.id, _loan.investor_id, auth.uid(), _interest,
     nullif(_method, ''), nullif(_notes, ''), 'interest_only')
  RETURNING id INTO _payment_id;

  UPDATE public.investor_loans
  SET due_date = _next_due_date, payment_method = nullif(_method, ''),
      status = 'active', paid_at = NULL
  WHERE id = _loan.id;

  INSERT INTO public.transactions
    (user_id, type, category, description, amount, date, investor_payment_id)
  VALUES
    (auth.uid(), 'expense', 'investor_interest_payment',
     'Pagamento somente dos juros ao investidor', _interest, now(), _payment_id);

  RETURN jsonb_build_object(
    'ok', true, 'payment_id', _payment_id, 'amount', _interest,
    'next_due_date', _next_due_date, 'remaining', greatest(0, _loan.total_due - _loan.paid_amount)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_investor_interest_payment(uuid, numeric, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_investor_interest_payment(uuid, numeric, date, text, text) TO authenticated;
