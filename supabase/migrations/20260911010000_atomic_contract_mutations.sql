-- Contract edits and deletions must be all-or-nothing. The client can fail
-- between two REST requests; these RPCs keep financial records consistent.
CREATE OR REPLACE FUNCTION public.update_contract_atomically(
  _contract_id uuid,
  _contract jsonb,
  _regenerate boolean DEFAULT false,
  _installments jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _old public.contracts%rowtype;
  _paid_count integer;
  _new_count integer;
  _requested_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _old FROM public.contracts
    WHERE id = _contract_id AND user_id = auth.uid() FOR UPDATE;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF jsonb_typeof(coalesce(_contract, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'invalid_contract'; END IF;

  _requested_count := (_contract->>'num_installments')::integer;
  IF _requested_count IS NULL OR _requested_count <= 0 THEN RAISE EXCEPTION 'invalid_installment_count'; END IF;
  IF (_contract->>'capital')::numeric IS NULL OR (_contract->>'capital')::numeric <= 0 THEN RAISE EXCEPTION 'invalid_capital'; END IF;
  IF (_contract->>'installment_amount')::numeric IS NULL OR (_contract->>'installment_amount')::numeric <= 0 THEN RAISE EXCEPTION 'invalid_installment_amount'; END IF;
  IF _regenerate AND jsonb_typeof(coalesce(_installments, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'invalid_installments'; END IF;

  SELECT count(*) INTO _paid_count
    FROM public.contract_installments
   WHERE contract_id = _contract_id AND user_id = auth.uid() AND status = 'paid';
  IF _regenerate AND EXISTS (
    SELECT 1 FROM public.contract_installments
     WHERE contract_id = _contract_id AND user_id = auth.uid() AND status = 'paid'
       AND (installment_number < 1 OR installment_number > _requested_count)
  ) THEN RAISE EXCEPTION 'paid_installment_would_be_removed'; END IF;
  IF _regenerate AND _paid_count > _requested_count THEN RAISE EXCEPTION 'paid_installment_would_be_removed'; END IF;

  UPDATE public.contracts SET
    capital = (_contract->>'capital')::numeric,
    interest_rate = coalesce((_contract->>'interest_rate')::numeric, 0),
    num_installments = _requested_count,
    installment_amount = (_contract->>'installment_amount')::numeric,
    frequency = coalesce(nullif(_contract->>'frequency', ''), frequency),
    start_date = coalesce((_contract->>'start_date')::timestamptz, start_date),
    late_fee_percent = coalesce((_contract->>'late_fee_percent')::numeric, 0),
    daily_interest_percent = coalesce((_contract->>'daily_interest_percent')::numeric, 0),
    total_amount = coalesce((_contract->>'total_amount')::numeric, 0),
    total_interest = coalesce((_contract->>'total_interest')::numeric, 0),
    notes = nullif(_contract->>'notes', '')
  WHERE id = _contract_id AND user_id = auth.uid();

  IF _regenerate THEN
    DELETE FROM public.contract_installments
     WHERE contract_id = _contract_id AND user_id = auth.uid() AND status <> 'paid';

    INSERT INTO public.contract_installments
      (user_id, contract_id, client_id, installment_number, amount, due_date, status)
    SELECT auth.uid(), _contract_id, _old.client_id, x.installment_number, x.amount, x.due_date, 'pending'
      FROM jsonb_to_recordset(_installments) AS x(
        installment_number integer, amount numeric, due_date timestamptz
      );

    SELECT count(*) INTO _new_count
      FROM public.contract_installments
     WHERE contract_id = _contract_id AND user_id = auth.uid();
    IF _new_count <> _requested_count THEN RAISE EXCEPTION 'installment_count_mismatch'; END IF;
  END IF;

  RETURN jsonb_build_object('contract_id', _contract_id, 'installment_count',
    (SELECT count(*) FROM public.contract_installments WHERE contract_id = _contract_id AND user_id = auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contract_atomically(_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = _contract_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  DELETE FROM public.transactions WHERE contract_id = _contract_id AND user_id = auth.uid();
  DELETE FROM public.contract_installments WHERE contract_id = _contract_id AND user_id = auth.uid();
  DELETE FROM public.contracts WHERE id = _contract_id AND user_id = auth.uid();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  IF _deleted <> 1 THEN RAISE EXCEPTION 'contract_delete_failed'; END IF;
  RETURN jsonb_build_object('contract_id', _contract_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_contract_atomically(uuid, jsonb, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_contract_atomically(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_contract_atomically(uuid, jsonb, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contract_atomically(uuid) TO authenticated;
