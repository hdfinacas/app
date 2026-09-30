-- 1) Remove view SECURITY DEFINER (security_invoker=false) não utilizada pelo app.
DROP VIEW IF EXISTS public.public_profiles;

-- 2) Realtime: escopo por membresia real do canal / participação na DM.
DROP POLICY IF EXISTS "scoped_realtime_read" ON realtime.messages;
DROP POLICY IF EXISTS "scoped_realtime_write" ON realtime.messages;

CREATE OR REPLACE FUNCTION public.can_access_chat_topic(_topic text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
  tid uuid;
BEGIN
  IF _user_id IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  IF _topic LIKE 'chat-msgs-%' THEN
    raw := substring(_topic from 11);
    BEGIN
      tid := raw::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;
    RETURN public.is_channel_member(tid, _user_id)
        OR public.is_dm_participant(tid, _user_id);
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_chat_topic(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_chat_topic(text, uuid) TO authenticated;

CREATE POLICY "scoped_realtime_read" ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('tenant:' || auth.uid()::text || ':%')
    OR realtime.topic() = ('chat-unread-global-' || auth.uid()::text)
    OR realtime.topic() = 'chat-presence'
    OR realtime.topic() = 'chat-membership-rt'
    OR public.can_access_chat_topic(realtime.topic(), auth.uid())
  );

CREATE POLICY "scoped_realtime_write" ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('tenant:' || auth.uid()::text || ':%')
    OR realtime.topic() = ('chat-unread-global-' || auth.uid()::text)
    OR realtime.topic() = 'chat-presence'
    OR realtime.topic() = 'chat-membership-rt'
    OR public.can_access_chat_topic(realtime.topic(), auth.uid())
  );