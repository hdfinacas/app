ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_cpf text,
  ADD COLUMN IF NOT EXISTS signature_user_agent text;

CREATE TABLE IF NOT EXISTS public.contract_signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_cpf text NOT NULL,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_signature_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_owner_views_contract_signatures ON public.contract_signature_events;
CREATE POLICY portal_owner_views_contract_signatures ON public.contract_signature_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.portal_contract_signatures(_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _client_id uuid; _result jsonb;
BEGIN
  SELECT client_id INTO _client_id FROM public.portal_sessions
  WHERE token = _session_token AND expires_at > now();
  IF _client_id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'signature_status', c.signature_status,
    'signed_at', c.signed_at, 'signer_name', c.signer_name
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO _result FROM public.contracts c WHERE c.client_id = _client_id;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_sign_contract(
  _session_token uuid,
  _contract_id uuid,
  _signer_name text,
  _cpf_confirmation text,
  _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _client public.clients%rowtype; _contract public.contracts%rowtype; _cpf text;
BEGIN
  SELECT c.* INTO _client
  FROM public.portal_sessions s JOIN public.clients c ON c.id = s.client_id
  WHERE s.token = _session_token AND s.expires_at > now();
  IF _client.id IS NULL THEN RAISE EXCEPTION 'portal_session_invalid'; END IF;

  SELECT * INTO _contract FROM public.contracts
  WHERE id = _contract_id AND client_id = _client.id FOR UPDATE;
  IF _contract.id IS NULL THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF coalesce(_contract.signature_status, 'not_required') = 'not_required' THEN RAISE EXCEPTION 'signature_not_required'; END IF;
  IF _contract.signature_status = 'signed' THEN
    RETURN jsonb_build_object('ok', true, 'already_signed', true, 'signed_at', _contract.signed_at);
  END IF;

  _cpf := regexp_replace(coalesce(_cpf_confirmation, ''), '\D', '', 'g');
  IF _cpf <> regexp_replace(coalesce(_client.cpf_cnpj, ''), '\D', '', 'g') THEN RAISE EXCEPTION 'cpf_mismatch'; END IF;
  IF length(trim(coalesce(_signer_name, ''))) < 3 THEN RAISE EXCEPTION 'invalid_signer_name'; END IF;

  UPDATE public.contracts SET
    signature_status = 'signed', signed_at = now(), signer_name = trim(_signer_name),
    signer_cpf = _cpf, signature_user_agent = left(_user_agent, 500),
    signature_url = '/portal-cliente', updated_at = now()
  WHERE id = _contract.id;

  INSERT INTO public.contract_signature_events
    (contract_id, client_id, user_id, signer_name, signer_cpf, user_agent)
  VALUES (_contract.id, _client.id, _client.user_id, trim(_signer_name), _cpf, left(_user_agent, 500));

  RETURN jsonb_build_object('ok', true, 'signed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.portal_contract_signatures(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_contract_signatures(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_sign_contract(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_sign_contract(uuid, uuid, text, text, text) TO anon, authenticated;
