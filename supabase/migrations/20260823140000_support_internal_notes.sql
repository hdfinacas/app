BEGIN;

ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "View messages of accessible tickets" ON public.support_ticket_messages;
CREATE POLICY "View support messages with internal note isolation"
ON public.support_ticket_messages
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    is_internal = false
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Insert messages with verified sender role" ON public.support_ticket_messages;
CREATE POLICY "Insert support messages with verified visibility"
ON public.support_ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (
      public.is_admin(auth.uid())
      AND sender_role = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
      )
    )
    OR (
      sender_role = 'user'
      AND is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
          AND t.user_id = auth.uid()
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.update_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nota interna não muda SLA/status e nunca aciona aviso para o assinante.
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_tickets
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_by_admin = CASE WHEN NEW.sender_role = 'user' THEN true ELSE unread_by_admin END,
    unread_by_user = CASE WHEN NEW.sender_role = 'admin' THEN true ELSE unread_by_user END,
    status = CASE
      WHEN NEW.sender_role = 'user' AND status = 'closed' THEN 'open'
      WHEN NEW.sender_role = 'admin' AND status = 'open' THEN 'answered'
      ELSE status
    END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

COMMIT;
