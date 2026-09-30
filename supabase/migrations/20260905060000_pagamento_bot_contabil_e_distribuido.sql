BEGIN;

-- Mesmo motor contábil de pay_installment, autorizado exclusivamente para o
-- service_role das automações. O total inclui multa quando ela for recebida.
CREATE OR REPLACE FUNCTION public.system_register_payment(
  _installment_id uuid,
  _paid_total numeric,
  _method text DEFAULT 'pix',
  _origem text DEFAULT 'sistema',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _prev_paid numeric; _new_total numeric; _new_money numeric;
  _contractual_paid numeric; _principal_total numeric; _interest_total numeric; _fees_total numeric;
  _new_principal numeric; _new_interest numeric; _new_fees numeric;
  _total_due numeric; _remaining integer; _is_paid boolean;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  _prev_paid := round(coalesce(_inst.paid_amount, 0)::numeric, 2);
  _total_due := round((coalesce(_inst.amount, 0) + coalesce(_inst.late_fee, 0))::numeric, 2);
  _new_total := least(round(coalesce(_paid_total, 0)::numeric, 2), _total_due);
  _new_money := round((_new_total - _prev_paid)::numeric, 2);
  IF _new_money <= 0 THEN RAISE EXCEPTION 'pagamento_duplicado_ou_inferior'; END IF;
  _is_paid := _new_total >= _total_due;

  _contractual_paid := least(_new_total, round(_inst.amount::numeric, 2));
  _principal_total := CASE WHEN _inst.amount > 0
    THEN round((_inst.scheduled_principal * _contractual_paid / _inst.amount)::numeric, 2) ELSE 0 END;
  _interest_total := round((_contractual_paid - _principal_total)::numeric, 2);
  _fees_total := round(greatest(0, _new_total - _inst.amount)::numeric, 2);
  _new_principal := round((_principal_total - coalesce(_inst.paid_principal, 0))::numeric, 2);
  _new_interest := round((_interest_total - coalesce(_inst.paid_interest, 0))::numeric, 2);
  _new_fees := round((_fees_total - coalesce(_inst.paid_fees, 0))::numeric, 2);

  UPDATE public.contract_installments SET
    paid_amount = _new_total, paid_principal = _principal_total,
    paid_interest = _interest_total, paid_fees = _fees_total,
    payment_method = _method, receipt_url = coalesce(_receipt_url, receipt_url),
    status = CASE WHEN _is_paid THEN 'paid'
      WHEN _inst.status = 'overdue' OR _inst.due_date < current_date THEN 'overdue' ELSE 'pending' END,
    paid_at = CASE WHEN _is_paid THEN now() ELSE paid_at END
  WHERE id = _installment_id;

  IF _interest_total + _fees_total > 0 THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (_inst.user_id, _interest_total + _fees_total,
      'Juros e encargos parcela #' || _inst.installment_number || ' (' || _origem || ')',
      _inst.client_id, _installment_id)
    ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL
    DO UPDATE SET amount = excluded.amount, description = excluded.description;
  END IF;

  INSERT INTO public.transactions
    (user_id, amount, type, category, description, client_id, contract_id,
     installment_id, principal_amount, interest_amount, fee_amount)
  VALUES (_inst.user_id, _new_money, 'payment', 'installment_payment',
    CASE WHEN _is_paid THEN 'Pagamento' ELSE 'Pagamento parcial' END ||
      ' parcela #' || _inst.installment_number || ' (' || _origem || ')',
    _inst.client_id, _inst.contract_id, _installment_id,
    greatest(0, _new_principal), greatest(0, _new_interest), greatest(0, _new_fees));

  IF _is_paid THEN
    SELECT count(*) INTO _remaining FROM public.contract_installments
    WHERE contract_id = _inst.contract_id AND status NOT IN ('paid', 'cancelled');
    IF _remaining = 0 THEN UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id; END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money,
    'paid_total', _new_total, 'remaining_balance', greatest(_total_due - _new_total, 0),
    'fully_paid', _is_paid, 'principal', greatest(0, _new_principal),
    'interest', greatest(0, _new_interest), 'fees', greatest(0, _new_fees));
END;
$$;

REVOKE ALL ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_register_payment(uuid, numeric, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.system_pay_client_balance(
  _client_id uuid, _amount numeric, _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL, _origin text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
  _available numeric := round(coalesce(_amount, 0)::numeric, 2);
  _applied numeric := 0; _due numeric; _part numeric;
  _paid_count integer := 0; _partial_count integer := 0;
  _details jsonb := '[]'::jsonb;
BEGIN
  IF _available <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id) THEN
    RAISE EXCEPTION 'cliente_nao_encontrado';
  END IF;

  FOR _inst IN SELECT * FROM public.contract_installments
    WHERE client_id = _client_id AND status NOT IN ('paid', 'cancelled')
    ORDER BY due_date, installment_number, created_at, id FOR UPDATE
  LOOP
    EXIT WHEN _available <= 0;
    _due := round(greatest(0, coalesce(_inst.amount, 0) + coalesce(_inst.late_fee, 0) - coalesce(_inst.paid_amount, 0))::numeric, 2);
    IF _due <= 0 THEN CONTINUE; END IF;
    _part := least(_available, _due);
    PERFORM public.system_register_payment(_inst.id, coalesce(_inst.paid_amount, 0) + _part, _method, _origin, _receipt_url);
    IF _part >= _due THEN _paid_count := _paid_count + 1; ELSE _partial_count := _partial_count + 1; END IF;
    _details := _details || jsonb_build_array(jsonb_build_object(
      'installment_id', _inst.id, 'installment_number', _inst.installment_number,
      'contract_id', _inst.contract_id, 'amount', _part, 'paid', _part >= _due));
    _available := round((_available - _part)::numeric, 2);
    _applied := round((_applied + _part)::numeric, 2);
  END LOOP;

  IF _applied <= 0 THEN RAISE EXCEPTION 'sem_parcelas_abertas'; END IF;
  IF _available > 0 THEN RAISE EXCEPTION 'pagamento_maior_que_saldo'; END IF;
  RETURN jsonb_build_object('ok', true, 'applied', _applied, 'remaining', _available,
    'paid_installments', _paid_count, 'partial_installments', _partial_count,
    'allocations', _details);
END;
$$;

REVOKE ALL ON FUNCTION public.system_pay_client_balance(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_pay_client_balance(uuid, numeric, text, text, text) TO service_role;

COMMIT;
