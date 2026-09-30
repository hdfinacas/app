CREATE OR REPLACE FUNCTION public.convert_whatsapp_lead_to_client(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _lead public.leads%rowtype;
  _client_id uuid;
  _phone_digits text;
  _cpf_digits text;
  _created boolean := false;
BEGIN
  SELECT * INTO _lead FROM public.leads
  WHERE id = _lead_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada ou sem permissao'; END IF;
  IF _lead.converted_client_id IS NOT NULL THEN
    RETURN jsonb_build_object('client_id', _lead.converted_client_id, 'created', false, 'already_converted', true);
  END IF;

  _phone_digits := regexp_replace(coalesce(_lead.phone, ''), '\D', '', 'g');
  _cpf_digits := regexp_replace(coalesce(_lead.cpf, ''), '\D', '', 'g');
  SELECT id INTO _client_id FROM public.clients
  WHERE user_id = auth.uid() AND (
    (_cpf_digits <> '' AND regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _cpf_digits)
    OR (_phone_digits <> '' AND (regexp_replace(coalesce(phone, ''), '\D', '', 'g') = _phone_digits OR regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = _phone_digits))
  ) ORDER BY created_at LIMIT 1;

  IF _client_id IS NULL THEN
    INSERT INTO public.clients (user_id, name, phone, whatsapp, cpf_cnpj, email, credit_score, documents, status, client_type)
    VALUES (auth.uid(), coalesce(nullif(btrim(_lead.name), ''), 'Cliente ' || coalesce(nullif(_lead.phone, ''), 'sem nome')),
      nullif(_lead.phone, ''), nullif(_lead.phone, ''), nullif(_lead.cpf, ''), nullif(_lead.email, ''),
      greatest(0, least(100, coalesce(_lead.score, 0))), coalesce(_lead.notes->'docs', '{}'::jsonb), 'active', 'loan')
    RETURNING id INTO _client_id;
    _created := true;
  ELSE
    UPDATE public.clients SET
      phone = coalesce(nullif(phone, ''), nullif(_lead.phone, '')),
      whatsapp = coalesce(nullif(whatsapp, ''), nullif(_lead.phone, '')),
      cpf_cnpj = coalesce(nullif(cpf_cnpj, ''), nullif(_lead.cpf, '')),
      email = coalesce(nullif(email, ''), nullif(_lead.email, '')),
      documents = CASE WHEN coalesce(documents, '{}'::jsonb) = '{}'::jsonb THEN coalesce(_lead.notes->'docs', '{}'::jsonb) ELSE documents END
    WHERE id = _client_id AND user_id = auth.uid();
  END IF;

  UPDATE public.leads SET converted_client_id = _client_id, stage = 'converted', updated_at = now()
  WHERE id = _lead.id AND user_id = auth.uid();
  UPDATE public.whatsapp_conversations SET client_id = _client_id, updated_at = now()
  WHERE user_id = auth.uid() AND _phone_digits <> '' AND regexp_replace(coalesce(phone, ''), '\D', '', 'g') = _phone_digits;
  RETURN jsonb_build_object('client_id', _client_id, 'created', _created, 'already_converted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.convert_whatsapp_lead_to_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_whatsapp_lead_to_client(uuid) TO authenticated;
