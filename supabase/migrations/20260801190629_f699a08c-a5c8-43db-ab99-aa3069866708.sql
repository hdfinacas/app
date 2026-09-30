-- ATENCAO: o valor do CRON_SECRET foi REMOVIDO deste arquivo.
-- Ele estava aqui em texto puro, num repositorio publico, protegendo os 11 cron
-- jobs. Esta migration ja rodou em producao; o arquivo fica como registro.
-- Para rotacionar (e passar a guardar o segredo no Vault, fora do Git), use
-- docs/rotacionar-cron-secret.sql.
BEGIN;
-- Security hardening: remove portal login by CPF only and require birth date as second factor.
-- Also rotate all pg_cron HTTP triggers to include the mandatory CRON_SECRET header.

-- 1. Remove the CPF-only portal login function (replaced by portal_client_login).
DROP FUNCTION IF EXISTS public.portal_client_login_cpf(text);

-- 2. Rewrite creditor contact lookup to require the client's birth date.
CREATE OR REPLACE FUNCTION public.portal_lookup_creditor_contact(_cpf text, _birth_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _owner_id uuid;
  _out jsonb;
BEGIN
  IF length(_clean_cpf) < 11 OR _birth_date IS NULL THEN RETURN NULL; END IF;

  SELECT c.user_id INTO _owner_id
  FROM public.clients c
  WHERE regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND c.birth_date = _birth_date
  ORDER BY c.created_at DESC LIMIT 1;

  IF _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'company_name', s.company_name,
    'portal_contact_phone', s.portal_contact_phone,
    'portal_contact_email', s.portal_contact_email
  ) INTO _out
  FROM public.settings s WHERE s.user_id = _owner_id LIMIT 1;

  RETURN coalesce(_out, '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_lookup_creditor_contact(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_lookup_creditor_contact(text, date) TO anon, authenticated;

-- 3. Unschedule existing cron jobs so they can be re-created with the secret header.
SELECT cron.unschedule('auto-late-fees-daily');
SELECT cron.unschedule('auto-notifications-daily');
SELECT cron.unschedule('auto-collection-hourly');
SELECT cron.unschedule('check-overdue-daily');
SELECT cron.unschedule('auto-subscription-daily');
SELECT cron.unschedule('auto-backup-daily');
SELECT cron.unschedule('auto-birthday-daily');
SELECT cron.unschedule('auto-credit-score-daily');
SELECT cron.unschedule('auto-cleanup-weekly');

-- 4. Re-schedule jobs with the mandatory CRON_SECRET header.
-- Multas e juros - todo dia 03:00
SELECT cron.schedule('auto-late-fees-daily', '0 3 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-late-fees',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Notificações internas - todo dia 06:00
SELECT cron.schedule('auto-notifications-daily', '0 6 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-notifications',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Cobrança WhatsApp - de hora em hora
SELECT cron.schedule('auto-collection-hourly', '0 * * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-collection',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Verificar atrasos - todo dia 07:00
SELECT cron.schedule('check-overdue-daily', '0 7 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/check-overdue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Assinaturas - todo dia 02:00
SELECT cron.schedule('auto-subscription-daily', '0 2 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-subscription-check',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Backup - todo dia 04:00
SELECT cron.schedule('auto-backup-daily', '0 4 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Aniversário - todo dia 09:00
SELECT cron.schedule('auto-birthday-daily', '0 9 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-birthday',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Score de crédito - todo dia 05:00
SELECT cron.schedule('auto-credit-score-daily', '0 5 * * *', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-credit-score',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Limpeza - toda segunda 01:00
SELECT cron.schedule('auto-cleanup-weekly', '0 1 * * 1', $job$
  SELECT net.http_post(
    url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-cleanup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REPLACE_WITH_NEW_SUPABASE_ANON_JWT","x-cron-secret":"SEGREDO_REMOVIDO_VER_docs/rotacionar-cron-secret.sql"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);
COMMIT;