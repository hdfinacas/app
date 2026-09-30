BEGIN;

-- ============================================================================
-- O cliente não recebe aviso no portal desde 07/07.
--
-- A `auto-late-fees` monta as notificações e grava com upsert, usando
-- `onConflict: "installment_id,type,dedupe_day"` para não repetir o mesmo aviso
-- no mesmo dia. O índice que sustenta isso existe — mas é PARCIAL:
--
--   CREATE UNIQUE INDEX uq_client_notifications_daily
--       ON client_notifications (installment_id, type, dedupe_day)
--    WHERE (installment_id IS NOT NULL);
--
-- Postgres só aceita ON CONFLICT contra índice parcial se a cláusula repetir o
-- MESMO predicado. O PostgREST manda apenas a lista de colunas, então a resposta
-- é sempre "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" — e a gravação inteira falha.
--
-- Resultado: 305 parcelas em atraso e ZERO avisos criados. A última notificação
-- de portal da base é de 07/07 às 21:53. O cliente abre o portal e não vê nada
-- sobre o próprio atraso.
--
-- O predicado é redundante: `installment_id` é nulável e, em índice único,
-- valores NULL nunca conflitam entre si. Sem o WHERE, o comportamento para as
-- linhas com `installment_id` preenchido é idêntico, e o ON CONFLICT passa a
-- casar.
-- ============================================================================

DROP INDEX IF EXISTS public.uq_client_notifications_daily;

CREATE UNIQUE INDEX uq_client_notifications_daily
    ON public.client_notifications (installment_id, type, dedupe_day);

COMMIT;
