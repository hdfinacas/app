-- End-to-end integrity hardening for contracts, payments and portal access.

ALTER TABLE public.contract_installments
  ADD COLUMN IF NOT EXISTS receipt_storage_path text,
  ADD COLUMN IF NOT EXISTS receipt_review_status text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_installments_receipt_review_status_check') THEN
    ALTER TABLE public.contract_installments
      ADD CONSTRAINT contract_installments_receipt_review_status_check
      CHECK (receipt_review_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END;
$$;

-- Preserve historical rows: never delete financial data during a migration.
-- Clean databases receive hard uniqueness constraints; legacy databases with
-- duplicates remain available and are protected by the row locks below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contract_installments
    GROUP BY contract_id, installment_number HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_installment_number
      ON public.contract_installments (contract_id, installment_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profits
    WHERE installment_id IS NOT NULL
    GROUP BY installment_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_profit_installment
      ON public.profits (installment_id) WHERE installment_id IS NOT NULL;
  END IF;
END;
$$;

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
  _contract public.contracts%rowtype;
  _prev_paid numeric;
  _new_money numeric;
  _interest numeric := 0;
  _remaining integer;
BEGIN
  SELECT * INTO _inst
  FROM public.contract_installments
  WHERE id = _installment_id
  FOR UPDATE;

  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  _prev_paid := round(COALESCE(_inst.paid_amount, 0)::numeric, 2);
  _paid_total := round(COALESCE(_paid_total, 0)::numeric, 2);

  IF _paid_total < _prev_paid THEN RAISE EXCEPTION 'paid_total_cannot_decrease'; END IF;
  IF _paid_total <= 0 THEN RAISE EXCEPTION 'invalid_paid_total'; END IF;

  -- Retrying a completed request is a no-op, not another financial event.
  IF _inst.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'new_money', 0, 'interest', 0);
  END IF;

  _new_money := round((_paid_total - _prev_paid)::numeric, 2);
  IF _new_money <= 0 AND NOT _mark_paid THEN
    RETURN jsonb_build_object('ok', true, 'already_applied', true, 'new_money', 0, 'interest', 0);
  END IF;

  UPDATE public.contract_installments
  SET paid_amount = _paid_total,
      payment_method = _method,
      receipt_url = COALESCE(_receipt_url, receipt_url),
      receipt_review_status = CASE
        WHEN _mark_paid AND COALESCE(_receipt_url, receipt_url) IS NOT NULL THEN 'approved'
        ELSE receipt_review_status
      END,
      status = CASE WHEN _mark_paid THEN 'paid' ELSE status END,
      paid_at = CASE WHEN _mark_paid THEN now() ELSE paid_at END
  WHERE id = _installment_id;

  IF _mark_paid THEN
    SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
    IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
      _interest := round((_inst.amount * (_contract.total_interest / _contract.total_amount))::numeric, 2);
    END IF;
    IF _interest > 0 AND NOT EXISTS (
      SELECT 1 FROM public.profits WHERE installment_id = _installment_id
    ) THEN
      INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
      VALUES (auth.uid(), _interest, 'Juros parcela #' || _inst.installment_number, _inst.client_id, _installment_id);
    END IF;
  END IF;

  IF _new_money > 0 THEN
    INSERT INTO public.transactions
      (user_id, amount, type, description, client_id, contract_id, installment_id)
    VALUES
      (auth.uid(), _new_money, 'payment', 'Pagamento parcela #' || _inst.installment_number,
       _inst.client_id, _inst.contract_id, _installment_id);
  END IF;

  IF _mark_paid THEN
    SELECT count(*) INTO _remaining
    FROM public.contract_installments
    WHERE contract_id = _inst.contract_id AND status <> 'paid';
    IF _remaining = 0 THEN
      UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money, 'interest', _interest);
END;
$$;

-- Waiving late fees and settling happen in the same database transaction.
CREATE OR REPLACE FUNCTION public.pay_installment_waiving_fees(
  _installment_id uuid,
  _paid_total numeric,
  _method text DEFAULT 'pix',
  _receipt_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
BEGIN
  SELECT user_id INTO _owner
  FROM public.contract_installments
  WHERE id = _installment_id
  FOR UPDATE;
  IF _owner IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.contract_installments SET late_fee = 0 WHERE id = _installment_id;
  RETURN public.pay_installment(_installment_id, _paid_total, true, _method, _receipt_url);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pay_installment_waiving_fees(uuid, numeric, text, text) TO authenticated;

-- CPF is not a password. Require the date of birth and refuse ambiguous records
-- (the same borrower can legitimately exist in more than one tenant).
CREATE OR REPLACE FUNCTION public.portal_client_login(
  _cpf text,
  _birth_date date DEFAULT NULL::date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client_id uuid;
  _matches integer;
  _token uuid;
  _rate jsonb;
BEGIN
  IF length(_clean_cpf) <> 11 OR _birth_date IS NULL THEN RETURN NULL; END IF;

  _rate := public.try_consume_rate_limit('portal-login:' || md5(_clean_cpf), 8, 8.0 / 900.0);
  IF NOT coalesce((_rate->>'allowed')::boolean, false) THEN RETURN NULL; END IF;

  SELECT count(*), min(id::text)::uuid
  INTO _matches, _client_id
  FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND birth_date = _birth_date
    AND lower(coalesce(status, 'ativo')) IN ('ativo', 'active');

  IF _matches <> 1 OR _client_id IS NULL THEN RETURN NULL; END IF;

  DELETE FROM public.portal_sessions
  WHERE client_id = _client_id AND expires_at < now();

  INSERT INTO public.portal_sessions (client_id)
  VALUES (_client_id)
  RETURNING token INTO _token;

  RETURN public.portal_login_by_token(_token);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_client_login(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_client_login(text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_client_login_for_owner(
  _cpf text,
  _birth_date date,
  _owner_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client_id uuid;
  _token uuid;
  _rate jsonb;
BEGIN
  IF length(_clean_cpf) <> 11 OR _birth_date IS NULL OR _owner_id IS NULL THEN RETURN NULL; END IF;
  _rate := public.try_consume_rate_limit('portal-login:' || md5(_owner_id::text || _clean_cpf), 8, 8.0 / 900.0);
  IF NOT coalesce((_rate->>'allowed')::boolean, false) THEN RETURN NULL; END IF;

  SELECT id INTO _client_id
  FROM public.clients
  WHERE user_id = _owner_id
    AND regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND birth_date = _birth_date
    AND lower(coalesce(status, 'ativo')) IN ('ativo', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  IF _client_id IS NULL THEN RETURN NULL; END IF;
  DELETE FROM public.portal_sessions WHERE client_id = _client_id AND expires_at < now();
  INSERT INTO public.portal_sessions (client_id) VALUES (_client_id) RETURNING token INTO _token;
  RETURN public.portal_login_by_token(_token);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_client_login_for_owner(text, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_client_login_for_owner(text, date, uuid) TO anon, authenticated;

-- Client + contract + schedule are created as one unit. JSON keeps the RPC
-- compatible as optional contract fields evolve, while ownership is enforced
-- exclusively from auth.uid().
CREATE OR REPLACE FUNCTION public.create_client_contract(
  _client_id uuid,
  _client jsonb,
  _contract jsonb,
  _installments jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _cid uuid := coalesce(_client_id, gen_random_uuid());
  _contract_id uuid := gen_random_uuid();
  _created_client boolean := _client_id IS NULL;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF jsonb_typeof(_installments) <> 'array' OR jsonb_array_length(_installments) = 0 THEN
    RAISE EXCEPTION 'installments_required';
  END IF;

  IF _created_client THEN
    INSERT INTO public.clients
      (id, user_id, name, email, phone, whatsapp, cpf_cnpj, birth_date,
       client_type, status, avatar_url, address)
    VALUES
      (_cid, auth.uid(), nullif(btrim(_client->>'name'), ''), nullif(btrim(_client->>'email'), ''),
       nullif(btrim(_client->>'phone'), ''), nullif(btrim(_client->>'whatsapp'), ''),
       nullif(btrim(_client->>'cpf_cnpj'), ''), nullif(_client->>'birth_date', '')::date,
       coalesce(nullif(_client->>'client_type', ''), 'loan'),
       coalesce(nullif(_client->>'status', ''), 'Ativo'), nullif(_client->>'avatar_url', ''),
       _client->'address');
  ELSIF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _cid AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;

  INSERT INTO public.contracts
    (id, user_id, client_id, capital, interest_rate, num_installments,
     installment_amount, frequency, start_date, late_fee_percent,
     daily_interest_percent, total_amount, total_interest, status, notes,
     loan_mode, grace_periods, grace_days, payment_method, auto_renew,
     early_payment_discount_percent, max_interest_cap_percent, guarantee_type,
     guarantee_description, guarantor_name, guarantor_cpf, guarantor_phone,
     attachments, investor_loan_id, signature_status, signature_token)
  VALUES
    (_contract_id, auth.uid(), _cid, (_contract->>'capital')::numeric,
     (_contract->>'interest_rate')::numeric, (_contract->>'num_installments')::integer,
     (_contract->>'installment_amount')::numeric, _contract->>'frequency',
     (_contract->>'start_date')::timestamptz, coalesce((_contract->>'late_fee_percent')::numeric, 0),
     coalesce((_contract->>'daily_interest_percent')::numeric, 0),
     (_contract->>'total_amount')::numeric, (_contract->>'total_interest')::numeric,
     coalesce(_contract->>'status', 'active'), nullif(_contract->>'notes', ''),
     nullif(_contract->>'loan_mode', ''), coalesce((_contract->>'grace_periods')::integer, 0),
     coalesce((_contract->>'grace_days')::integer, 0), nullif(_contract->>'payment_method', ''),
     coalesce((_contract->>'auto_renew')::boolean, false),
     coalesce((_contract->>'early_payment_discount_percent')::numeric, 0),
     nullif(_contract->>'max_interest_cap_percent', '')::numeric,
     nullif(_contract->>'guarantee_type', ''), nullif(_contract->>'guarantee_description', ''),
     nullif(_contract->>'guarantor_name', ''), nullif(_contract->>'guarantor_cpf', ''),
     nullif(_contract->>'guarantor_phone', ''), coalesce(_contract->'attachments', '[]'::jsonb),
     nullif(_contract->>'investor_loan_id', '')::uuid,
     coalesce(_contract->>'signature_status', 'not_required'),
     nullif(_contract->>'signature_token', '')::text);

  INSERT INTO public.contract_installments
    (user_id, contract_id, client_id, installment_number, amount, due_date, status)
  SELECT auth.uid(), _contract_id, _cid, x.installment_number, x.amount, x.due_date, 'pending'
  FROM jsonb_to_recordset(_installments) AS x(
    installment_number integer,
    amount numeric,
    due_date timestamptz
  );

  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count <> (_contract->>'num_installments')::integer THEN
    RAISE EXCEPTION 'installment_count_mismatch';
  END IF;

  RETURN jsonb_build_object('client_id', _cid, 'contract_id', _contract_id, 'installment_count', _count);
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_contract(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_contract(uuid, jsonb, jsonb, jsonb) TO authenticated;
