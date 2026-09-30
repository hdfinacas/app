CREATE TABLE IF NOT EXISTS public.whatsapp_response_windows (
  user_id uuid NOT NULL, jid text NOT NULL, claimed_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id,jid)
);
ALTER TABLE public.whatsapp_response_windows ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_response_windows TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_response_window(
  _user_id uuid, _jid text, _seconds integer DEFAULT 8
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
  INSERT INTO public.whatsapp_response_windows(user_id,jid,claimed_until,updated_at)
  VALUES (_user_id,_jid,now()+make_interval(secs=>greatest(3,least(_seconds,30))),now())
  ON CONFLICT (user_id,jid) DO UPDATE SET claimed_until=EXCLUDED.claimed_until,updated_at=now()
  WHERE public.whatsapp_response_windows.claimed_until < now();
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END; $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_response_window(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_response_window(uuid,text,integer) TO service_role;
