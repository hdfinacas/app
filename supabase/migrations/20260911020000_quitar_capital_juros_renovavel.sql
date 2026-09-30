-- Quita uma cobrança renovável (por porcentagem) separando principal e juros.
CREATE OR REPLACE FUNCTION public.settle_percentage_installment(
  _installment_id uuid,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _contract public.contracts%rowtype;
  _principal numeric;
  _interest numeric;
  _total numeric;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL OR _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.status IN ('paid', 'cancelled') THEN RAISE EXCEPTION 'installment_closed'; END IF;
  SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id AND user_id = auth.uid();
  IF _contract.id IS NULL THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF _contract.loan_mode NOT IN ('percentage', 'interest_only') THEN RAISE EXCEPTION 'not_renewable_contract'; END IF;

  _principal := greatest(0, coalesce(_contract.capital, 0));
  _interest := greatest(0, coalesce(_inst.amount, 0));
  _total := round((_principal + _interest + greatest(0, coalesce(_inst.late_fee, 0)))::numeric, 2);
  IF _total <= 0 THEN RAISE EXCEPTION 'invalid_settlement_amount'; END IF;

  UPDATE public.contract_installments
  SET amount = round((_principal + _interest)::numeric, 2),
      scheduled_principal = _principal,
      scheduled_interest = _interest
  WHERE id = _inst.id;

  RETURN public.pay_installment(_installment_id, _total, true, _method, _receipt_url);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_percentage_installment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_percentage_installment(uuid, text, text) TO authenticated;
