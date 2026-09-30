-- Habilita extensões necessárias para agendamento HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-backup-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda backup diário às 03:00 UTC (00:00 BRT)
SELECT cron.schedule(
  'auto-backup-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);