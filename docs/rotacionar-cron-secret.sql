-- ============================================================================
-- Rotação do CRON_SECRET — e fim do segredo dentro do repositório.
--
-- POR QUE: o valor antigo foi versionado em texto puro nas migrations de
-- 2026-08-01 (22 ocorrências) e este repositório é público. O gate funciona
-- (segredo errado responde 401), mas com um segredo que qualquer um lê.
--
-- O QUE MUDA: os cron jobs param de carregar o segredo escrito no comando e
-- passam a buscá-lo do Vault do Supabase em tempo de execução. Depois disto,
-- rotacionar é trocar UMA linha no Vault — nenhum arquivo precisa mudar, e
-- nenhum segredo volta para o Git.
--
-- COMO USAR
--   1. Gere um valor novo (64 caracteres hex). No terminal:
--        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--   2. Substitua COLE_O_SEGREDO_NOVO_AQUI abaixo — nas DUAS ocorrências.
--   3. Rode este arquivo inteiro no SQL editor do Supabase.
--   4. No painel do Supabase, vá em Edge Functions → Secrets e atualize
--      CRON_SECRET para o MESMO valor. (As funções leem de lá; o Vault serve
--      para o lado do banco.)
--   5. Confira com o bloco de verificação no fim.
--
-- NÃO faça commit deste arquivo com o valor preenchido. Ele existe justamente
-- para o segredo nunca mais entrar no Git.
-- ============================================================================

BEGIN;

-- ── 1. Guarda o segredo no Vault ────────────────────────────────────────────
DO $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM vault.secrets WHERE name = 'cron_secret';
  IF _id IS NULL THEN
    PERFORM vault.create_secret(
      'COLE_O_SEGREDO_NOVO_AQUI',
      'cron_secret',
      'Segredo dos cron jobs — enviado no header x-cron-secret'
    );
  ELSE
    PERFORM vault.update_secret(_id, 'COLE_O_SEGREDO_NOVO_AQUI');
  END IF;
END $$;

-- ── 2. Reagenda todos os jobs lendo o segredo do Vault ──────────────────────
-- A anon key continua literal de propósito: ela é pública por definição.
DO $$
DECLARE
  _base  text := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/';
  _anon  text := 'REPLACE_WITH_NEW_SUPABASE_ANON_JWT';
  _job   record;
BEGIN
  FOR _job IN
    SELECT * FROM (VALUES
      ('auto-late-fees-daily',          '0 3 * * *',    'auto-late-fees'),
      ('auto-notifications-daily',      '0 6 * * *',    'auto-notifications'),
      ('auto-collection-hourly',        '0 * * * *',    'auto-collection'),
      ('check-overdue-daily',           '0 7 * * *',    'check-overdue'),
      ('auto-subscription-daily',       '0 2 * * *',    'auto-subscription-check'),
      ('auto-backup-daily',             '0 4 * * *',    'auto-backup'),
      ('auto-birthday-daily',           '0 9 * * *',    'auto-birthday'),
      ('auto-credit-score-daily',       '0 5 * * *',    'auto-credit-score'),
      ('auto-cleanup-weekly',           '0 1 * * 1',    'auto-cleanup'),
      ('whatsapp-schedule-runner',      '* * * * *',    'whatsapp-schedule-runner'),
      ('whatsapp-followup-every-30min', '*/30 * * * *', 'whatsapp-followup'),
      -- Este estava sem o header e levava 401 todo dia: os investidores NÃO
      -- estavam sendo notificados. Entra na lista corrigido.
      ('investor-notify-daily',         '0 9 * * *',    'investor-notify')
    ) AS t(nome, agenda, funcao)
  LOOP
    BEGIN
      PERFORM cron.unschedule(_job.nome);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(_job.nome, _job.agenda, format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb
      );
    $cmd$, _base || _job.funcao, _anon));
  END LOOP;
END $$;

-- ── 3. Remove o job duplicado ───────────────────────────────────────────────
-- `auto-collection-hourly` já roda de hora em hora, inclusive às 12h. O job
-- diário das 12h era redundante e hoje está inerte (sem header, leva 401).
-- Reativá-lo faria o cliente receber a mesma cobrança duas vezes.
DO $$ BEGIN
  PERFORM cron.unschedule('auto-collection-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- ── 4. Verificação ──────────────────────────────────────────────────────────
-- `com_segredo_no_comando` PRECISA dar 0. Se der mais que isso, sobrou valor
-- literal em algum job.
SELECT count(*)                                                        AS jobs_ativos,
       count(*) FILTER (WHERE command ~ '[a-f0-9]{32,}'
                          AND command NOT ILIKE '%decrypted_secrets%') AS com_segredo_no_comando,
       count(*) FILTER (WHERE command ILIKE '%decrypted_secrets%')     AS lendo_do_vault
  FROM cron.job
 WHERE active;

-- Depois de rodar, teste que o valor ANTIGO parou de funcionar (deve dar 401):
--   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
--     https://asbylljmekwaovtzbqje.supabase.co/functions/v1/auto-backup \
--     -H "x-cron-secret: 46acf04c77693e72dfff21391c61996837903e824b60063c0922fc52f94b2786"
