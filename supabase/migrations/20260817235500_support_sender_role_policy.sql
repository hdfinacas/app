BEGIN;

-- Um assinante podia chamar a API diretamente com sender_role='admin'. Além de
-- exibir a mensagem como oficial, o trigger mudava o ticket para "respondido".
DROP POLICY IF EXISTS "Insert messages on accessible tickets" ON public.support_ticket_messages;

CREATE POLICY "Insert messages with verified sender role"
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
    OR
    (
      sender_role = 'user'
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
          AND t.user_id = auth.uid()
      )
    )
  )
);

COMMIT;
