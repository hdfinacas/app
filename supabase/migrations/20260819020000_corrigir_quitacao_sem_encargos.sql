-- Quitação sem encargos em uma única transação, com autorização explícita.
CREATE OR REPLACE FUNCTION public.pay_installment_waiving_fees(
  _installment_id uuid,
  _paid_total numeric,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _contract public.contracts%rowtype;
  _caller uuid := auth.uid();
  _prev_paid numeric;
  _new_money numeric;
  _interest numeric := 0;
  _waived numeric;
  _remaining integer;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO _inst FROM public.contract_installments
  WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> _caller THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _inst.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true,
      'new_money', 0, 'interest', 0, 'waived_fee', 0);
  END IF;

  _prev_paid := round(COALESCE(_inst.paid_amount, 0)::numeric, 2);
  _paid_total := round(COALESCE(_paid_total, 0)::numeric, 2);
  _waived := round(COALESCE(_inst.late_fee, 0)::numeric, 2);

  -- Perdoar os encargos quita o valor original, nunca menos que ele.
  IF abs(_paid_total - round(_inst.amount::numeric, 2)) > 0.005 THEN
    RAISE EXCEPTION 'invalid_waived_payment_total';
  END IF;
  IF _paid_total < _prev_paid THEN RAISE EXCEPTION 'paid_total_cannot_decrease'; END IF;
  _new_money := round((_paid_total - _prev_paid)::numeric, 2);

  UPDATE public.contract_installments
  SET late_fee = 0, paid_amount = _paid_total, payment_method = _method,
      receipt_url = COALESCE(_receipt_url, receipt_url),
      receipt_review_status = CASE
        WHEN COALESCE(_receipt_url, receipt_url) IS NOT NULL THEN 'approved'
        ELSE receipt_review_status END,
      status = 'paid', paid_at = now()
  WHERE id = _installment_id;

  SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
  IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
    _interest := round((_inst.amount * (_contract.total_interest / _contract.total_amount))::numeric, 2);
  END IF;
  IF _interest > 0 AND NOT EXISTS (
    SELECT 1 FROM public.profits WHERE installment_id = _installment_id
  ) THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (_caller, _interest, 'Juros parcela #' || _inst.installment_number,
      _inst.client_id, _installment_id);
  END IF;

  IF _new_money > 0 THEN
    INSERT INTO public.transactions
      (user_id, amount, type, description, client_id, contract_id, installment_id)
    VALUES (_caller, _new_money, 'payment',
      'Pagamento sem encargos parcela #' || _inst.installment_number,
      _inst.client_id, _inst.contract_id, _installment_id);
  END IF;

  SELECT count(*) INTO _remaining FROM public.contract_installments
  WHERE contract_id = _inst.contract_id AND status <> 'paid';
  IF _remaining = 0 THEN
    UPDATE public.contracts SET status = 'completed'
    WHERE id = _inst.contract_id AND user_id = _caller;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money,
    'interest', _interest, 'waived_fee', _waived);
END;
$$;

REVOKE ALL ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) TO authenticated;
