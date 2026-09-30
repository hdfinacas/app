-- ATENCAO: o valor do CRON_SECRET foi REMOVIDO deste arquivo.
-- Ele estava aqui em texto puro, num repositorio publico, protegendo os 11 cron
-- jobs. Esta migration ja rodou em producao; o arquivo fica como registro.
-- Para rotacionar (e passar a guardar o segredo no Vault, fora do Git), use
-- docs/rotacionar-cron-secret.sql.
BEGIN;
-- Rotate remaining cron jobs to include the mandatory CRON_SECRET header.

-- whatsapp-schedule-runner every minute
DO $$ BEGIN
  PERFORM cron.unschedule('whatsapp-schedule-runner');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'whatsapp-schedule-runner',
  '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/whatsapp-schedule-runner',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := jsonb_build_object('time', now())
  ); $$
);

-- whatsapp-followup every 30 minutes
SELECT cron.unschedule('whatsapp-followup-every-30min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='whatsapp-followup-every-30min');

SELECT cron.schedule(
  'whatsapp-followup-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/whatsapp-followup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
COMMIT;