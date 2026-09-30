-- Evita disparos duplicados quando duas execuções de cron se sobrepõem.
ALTER TABLE public.whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_due_whatsapp_messages(_limit integer DEFAULT 50)
RETURNS SETOF public.whatsapp_scheduled_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.whatsapp_scheduled_messages
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(_limit, 50), 100))
  )
  UPDATE public.whatsapp_scheduled_messages m
     SET status = 'processing', claimed_at = now(), attempts = m.attempts + 1, error = NULL
    FROM due
   WHERE m.id = due.id
  RETURNING m.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_whatsapp_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_whatsapp_messages(integer) TO service_role;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS followup_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_followups(_limit integer DEFAULT 50)
RETURNS SETOF public.whatsapp_conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.whatsapp_conversations
    WHERE last_message_from = 'client'
      AND bot_paused = false AND blocked = false AND needs_human = false
      AND followup_sent_at IS NULL
      AND last_message_at BETWEEN now() - interval '48 hours' AND now() - interval '6 hours'
      AND (followup_claimed_at IS NULL OR followup_claimed_at < now() - interval '15 minutes')
    ORDER BY last_message_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(_limit, 50), 100))
  )
  UPDATE public.whatsapp_conversations c
     SET followup_claimed_at = now()
    FROM candidates
   WHERE c.id = candidates.id
  RETURNING c.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_followups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_followups(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.collection_dispatch_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  claim_bucket timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id, channel, claim_bucket)
);
ALTER TABLE public.collection_dispatch_claims ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.collection_dispatch_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_collection_dispatch(
  _user_id uuid, _client_id uuid, _channel text, _bucket timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  IF _channel NOT IN ('whatsapp', 'email') THEN RETURN false; END IF;
  INSERT INTO public.collection_dispatch_claims(user_id, client_id, channel, claim_bucket)
  VALUES (_user_id, _client_id, _channel, date_trunc('hour', _bucket))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_collection_dispatch(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_collection_dispatch(uuid, uuid, text, timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS idx_collection_dispatch_claims_created
  ON public.collection_dispatch_claims(created_at);

