-- Portal do cliente: acesso somente por CPF, conforme regra do produto.
-- Mantemos limite de tentativas e recusamos CPFs ambiguos para impedir acesso
-- cruzado entre tenants. A assinatura antiga e preservada para compatibilidade.

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
  IF length(_clean_cpf) <> 11 THEN RETURN NULL; END IF;

  _rate := public.try_consume_rate_limit('portal-login:' || md5(_clean_cpf), 8, 8.0 / 900.0);
  IF NOT coalesce((_rate->>'allowed')::boolean, false) THEN RETURN NULL; END IF;

  SELECT count(*), min(id::text)::uuid
    INTO _matches, _client_id
  FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND lower(coalesce(status, 'ativo')) IN ('ativo', 'active');

  IF _matches <> 1 OR _client_id IS NULL THEN RETURN NULL; END IF;

  DELETE FROM public.portal_sessions WHERE client_id = _client_id AND expires_at < now();
  INSERT INTO public.portal_sessions (client_id) VALUES (_client_id) RETURNING token INTO _token;
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
  _matches integer;
  _token uuid;
  _rate jsonb;
BEGIN
  IF length(_clean_cpf) <> 11 OR _owner_id IS NULL THEN RETURN NULL; END IF;

  _rate := public.try_consume_rate_limit('portal-login:' || md5(_owner_id::text || _clean_cpf), 8, 8.0 / 900.0);
  IF NOT coalesce((_rate->>'allowed')::boolean, false) THEN RETURN NULL; END IF;

  SELECT count(*), min(id::text)::uuid
    INTO _matches, _client_id
  FROM public.clients
  WHERE user_id = _owner_id
    AND regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND lower(coalesce(status, 'ativo')) IN ('ativo', 'active');

  IF _matches <> 1 OR _client_id IS NULL THEN RETURN NULL; END IF;

  DELETE FROM public.portal_sessions WHERE client_id = _client_id AND expires_at < now();
  INSERT INTO public.portal_sessions (client_id) VALUES (_client_id) RETURNING token INTO _token;
  RETURN public.portal_login_by_token(_token);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_client_login_for_owner(text, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_client_login_for_owner(text, date, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_lookup_creditor_contact(_cpf text, _birth_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _owner_id uuid;
  _matches integer;
  _out jsonb;
BEGIN
  IF length(_clean_cpf) <> 11 THEN RETURN NULL; END IF;

  SELECT count(*), min(user_id::text)::uuid
    INTO _matches, _owner_id
  FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND lower(coalesce(status, 'ativo')) IN ('ativo', 'active');

  IF _matches <> 1 OR _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'company_name', s.company_name,
    'portal_contact_phone', s.portal_contact_phone,
    'portal_contact_email', s.portal_contact_email
  ) INTO _out
  FROM public.settings s WHERE s.user_id = _owner_id LIMIT 1;

  RETURN coalesce(_out, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_lookup_creditor_contact(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_lookup_creditor_contact(text, date) TO anon, authenticated;
