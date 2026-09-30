-- Cada renovação é um recebimento independente. O lucro não pode usar
-- installment_id porque existe uma trava de unicidade usada pela quitação
-- normal da parcela; reutilizá-lo fazia a segunda renovação (ou uma parcela
-- com lucro já registrado) abortar por chave duplicada.
CREATE OR REPLACE FUNCTION public.renew_installment_interest(
  _installment_id uuid,
  _next_due_date date,
  _method text DEFAULT 'pix',
  _origin text DEFAULT 'painel'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _inst public.contract_installments%rowtype;
  _contract public.contracts%rowtype;
  _period_interest numeric;
  _late_charges numeric;
  _received numeric;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _inst
  FROM public.contract_installments
  WHERE id = _installment_id AND user_id = _caller
  FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.status IN ('paid', 'cancelled') THEN RAISE EXCEPTION 'installment_closed'; END IF;
  IF _next_due_date IS NULL OR _next_due_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'invalid_next_due_date';
  END IF;

  SELECT * INTO _contract
  FROM public.contracts
  WHERE id = _inst.contract_id AND user_id = _caller;
  IF _contract.id IS NULL THEN RAISE EXCEPTION 'contract_not_found'; END IF;

  _period_interest := CASE
    WHEN coalesce(_inst.scheduled_interest, 0) > 0 THEN _inst.scheduled_interest
    WHEN _contract.loan_mode = 'bullet' THEN coalesce(_contract.total_interest, 0)
    WHEN _contract.loan_mode IN ('percentage', 'interest_only')
      THEN coalesce(_contract.capital, 0) * coalesce(_contract.interest_rate, 0) / 100
    WHEN coalesce(_contract.num_installments, 0) > 0
      THEN coalesce(_contract.total_interest, 0) / _contract.num_installments
    ELSE coalesce(_contract.capital, 0) * coalesce(_contract.interest_rate, 0) / 100
  END;
  _late_charges := greatest(0, coalesce(_inst.late_fee, 0));
  _received := round((greatest(0, _period_interest) + _late_charges)::numeric, 2);
  IF _received <= 0 THEN RAISE EXCEPTION 'interest_amount_is_zero'; END IF;

  UPDATE public.contract_installments
  SET due_date = _next_due_date,
      late_fee = 0,
      paid_amount = 0,
      paid_at = NULL,
      status = 'pending',
      payment_method = coalesce(nullif(_method, ''), 'pix')
  WHERE id = _inst.id;

  INSERT INTO public.transactions
    (user_id, amount, type, category, description, client_id, contract_id,
     installment_id, principal_amount, interest_amount, fee_amount)
  VALUES
    (_caller, _received, 'payment', 'interest_renewal',
     'Renovação por pagamento somente dos juros (' || coalesce(nullif(_origin, ''), 'painel') || ')',
     _inst.client_id, _inst.contract_id, _inst.id, 0,
     round(greatest(0, _period_interest)::numeric, 2), _late_charges);

  -- NULL é intencional: permite várias renovações da mesma parcela sem
  -- conflitar com uq_profit_installment nem ser apagado numa quitação futura.
  INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
  VALUES (
    _caller,
    _received,
    'Juros de renovação · parcela #' || coalesce(_inst.installment_number::text, '-'),
    _inst.client_id,
    NULL
  );

  INSERT INTO public.audit_logs (user_id, entity_type, action, entity_id, details)
  VALUES (_caller, 'installment', 'interest_renewal', _inst.id,
    jsonb_build_object(
      'amount', _received,
      'period_interest', round(greatest(0, _period_interest)::numeric, 2),
      'late_charges', _late_charges,
      'previous_due_date', _inst.due_date,
      'next_due_date', _next_due_date,
      'method', _method,
      'origin', _origin
    ));

  RETURN jsonb_build_object(
    'ok', true,
    'amount', _received,
    'principal_kept', _contract.capital,
    'previous_due_date', _inst.due_date,
    'next_due_date', _next_due_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.renew_installment_interest(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_installment_interest(uuid, date, text, text) TO authenticated;
