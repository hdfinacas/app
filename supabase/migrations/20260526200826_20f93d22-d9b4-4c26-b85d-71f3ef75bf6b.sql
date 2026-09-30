
SELECT cron.unschedule('whatsapp-followup-every-30min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='whatsapp-followup-every-30min');

SELECT cron.schedule(
  'whatsapp-followup-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://asbylljmekwaovtzbqje.supabase.co/functions/v1/whatsapp-followup',
    headers:='{"Content-Type":"application/json","apikey":"REPLACE_WITH_NEW_SUPABASE_ANON_JWT"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
