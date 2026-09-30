-- Schedule auto-late-fees: every day at 06:00 UTC (03:00 BRT)
SELECT cron.schedule(
  'auto-late-fees-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-late-fees',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule auto-notifications: every day at 06:15 UTC (03:15 BRT)
SELECT cron.schedule(
  'auto-notifications-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule auto-collection: every day at 12:00 UTC (09:00 BRT)
SELECT cron.schedule(
  'auto-collection-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-collection',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);