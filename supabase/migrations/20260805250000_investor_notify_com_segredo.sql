BEGIN;

-- ============================================================================
-- `investor-notify-daily` chamava sem o segredo e levava 401 todo dia.
--
-- A migration de 01/08 passou a exigir `x-cron-secret` nas funções de cron e
-- reagendou as rotinas — mas removeu as antigas por uma lista de nomes, e
-- `investor-notify-daily` não estava nela. Ficou chamando do jeito antigo.
--
-- `cron.job_run_details` marca "succeeded" porque quem teve sucesso foi o
-- `net.http_post`; a resposta HTTP ninguém lê. Então a rotina falhava calada.
-- Hoje há 2 investidores e 8 aportes ativos que deveriam estar recebendo aviso.
--
-- O cabeçalho é copiado de uma rotina que já funciona, em vez de escrito aqui:
-- este repositório é público, e o segredo não deve aparecer em arquivo nenhum.
-- ============================================================================

DO $$
DECLARE
  _cabecalho text;
  _jobid     bigint;
BEGIN
  SELECT (regexp_match(command, 'headers := ''(\{.*?\})''::jsonb'))[1]
    INTO _cabecalho
    FROM cron.job
   WHERE jobname = 'auto-late-fees-daily'
   LIMIT 1;

  IF _cabecalho IS NULL OR _cabecalho NOT LIKE '%x-cron-secret%' THEN
    RAISE EXCEPTION 'não achei um cabeçalho com x-cron-secret para copiar';
  END IF;

  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'investor-notify-daily';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
  END IF;

  PERFORM cron.schedule(
    'investor-notify-daily',
    '0 9 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := 'https://asbylljmekwaovtzbqje.supabase.co/functions/v1/investor-notify',
        headers := %L::jsonb,
        body := '{}'::jsonb
      );$cmd$,
      _cabecalho
    )
  );
END $$;

COMMIT;
