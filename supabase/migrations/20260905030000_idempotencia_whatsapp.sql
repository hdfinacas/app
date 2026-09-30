CREATE TABLE IF NOT EXISTS public.whatsapp_event_claims (
  user_id uuid NOT NULL,
  instance text NOT NULL,
  message_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, instance, message_id)
);

ALTER TABLE public.whatsapp_event_claims ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_event_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_event(
  _user_id uuid, _instance text, _message_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  IF _user_id IS NULL OR nullif(btrim(_instance),'') IS NULL OR nullif(btrim(_message_id),'') IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.whatsapp_event_claims(user_id,instance,message_id)
  VALUES (_user_id,btrim(_instance),btrim(_message_id))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_event(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_event(uuid,text,text) TO service_role;

CREATE INDEX IF NOT EXISTS idx_whatsapp_event_claims_age
  ON public.whatsapp_event_claims(claimed_at);

-- Proteção adicional no histórico: o mesmo ID externo não pode ser gravado duas
-- vezes para o mesmo assinante, ainda que outro caminho tente persistir o evento.
DELETE FROM public.whatsapp_messages a USING public.whatsapp_messages b
WHERE a.user_id=b.user_id AND a.wa_message_id=b.wa_message_id
  AND a.wa_message_id IS NOT NULL AND a.created_at>b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_external_id
  ON public.whatsapp_messages(user_id,wa_message_id)
  WHERE wa_message_id IS NOT NULL;
