BEGIN;

-- Mantém a parcela aberta enquanto houver saldo e contabiliza apenas o valor
-- efetivamente recebido em cada pagamento parcial.
CREATE OR REPLACE FUNCTION public.system_register_payment(
  _installment_id uuid,
  _paid_total numeric,
  _method text DEFAULT 'pix',
  _origem text DEFAULT 'sistema',
  _receipt_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _contract public.contracts%rowtype;
  _prev_paid numeric;
  _new_total numeric;
  _new_money numeric;
  _interest numeric := 0;
  _remaining int;
  _is_paid boolean;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  IF _paid_total IS NULL OR _paid_total <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;

  _prev_paid := COALESCE(_inst.paid_amount, 0);
  _new_total := LEAST(round(_paid_total::numeric, 2), round(_inst.amount::numeric, 2));
  _new_money := round((_new_total - _prev_paid)::numeric, 2);
  IF _new_money <= 0 THEN RAISE EXCEPTION 'pagamento_duplicado_ou_inferior'; END IF;
  _is_paid := _new_total >= round(_inst.amount::numeric, 2);

  UPDATE public.contract_installments
     SET paid_amount = _new_total,
         payment_method = _method,
         receipt_url = COALESCE(_receipt_url, receipt_url),
         status = CASE
           WHEN _is_paid THEN 'paid'
           WHEN _inst.status = 'overdue' OR _inst.due_date < CURRENT_DATE THEN 'overdue'
           ELSE 'pending'
         END,
         paid_at = CASE WHEN _is_paid THEN now() ELSE paid_at END
   WHERE id = _installment_id;

  SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
  IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
    _interest := round((_new_money * (_contract.total_interest / _contract.total_amount))::numeric, 2);
  END IF;

  IF _interest > 0 THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (_inst.user_id, _interest,
      'Juros proporcionais parcela #' || _inst.installment_number || ' (' || _origem || ')',
      _inst.client_id, _installment_id);
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, description, client_id, contract_id, installment_id)
  VALUES (_inst.user_id, _new_money, 'payment',
    CASE WHEN _is_paid THEN 'Pagamento' ELSE 'Pagamento parcial' END ||
    ' parcela #' || _inst.installment_number || ' (' || _origem || ')',
    _inst.client_id, _inst.contract_id, _installment_id);

  SELECT count(*) INTO _remaining FROM public.contract_installments
   WHERE contract_id = _inst.contract_id AND status NOT IN ('paid', 'cancelled');
  IF _remaining = 0 THEN
    UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'new_money', _new_money, 'paid_total', _new_total,
    'remaining_balance', GREATEST(round(_inst.amount::numeric, 2) - _new_total, 0),
    'fully_paid', _is_paid, 'interest', _interest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) TO service_role;

COMMIT;
