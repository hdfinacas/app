BEGIN;

-- ============================================================================
-- As rotinas disparavam e não esperavam a resposta.
--
-- `net.http_post` desiste depois de 5 segundos por padrão. A `auto-collection`
-- roda de hora em hora, percorre clientes e chama a IA — passa de 5 segundos
-- fácil. Resultado, todo dia, em todo minuto zero: `net._http_response` grava
-- "Timeout of 5000 ms reached" e NENHUM código de status.
--
-- A função continua rodando do lado do Supabase; o que se perde é a resposta.
-- E é justamente por ela que se descobre que algo quebrou: foi assim que
-- `investor-notify` e `auto-collection-daily` passaram dias devolvendo 401 sem
-- ninguém perceber — `cron.job_run_details` dizia "succeeded" porque o disparo
-- teve sucesso, e a resposta HTTP não existia para desmentir.
--
-- Com 2 minutos de espera, a resposta fica registrada e dá para auditar assim:
--
--   SELECT to_char(created,'DD/MM HH24:MI') AS quando, status_code, left(content,120)
--     FROM net._http_response
--    WHERE created > now() - interval '24 hours' AND status_code <> 200
--    ORDER BY created DESC;
--
-- Toda linha aí merece olhada. Nenhuma = rotinas saudáveis.
-- ============================================================================

DO $$
DECLARE
  _job     record;
  _url     text;
  _agenda  text;
BEGIN
  FOR _job IN SELECT jobid, jobname, schedule, command FROM cron.job LOOP
    _url := (regexp_match(_job.command, 'url := ''([^'']+)'''))[1];
    IF _url IS NULL THEN
      RAISE NOTICE 'pulando % (não consegui ler a url)', _job.jobname;
      CONTINUE;
    END IF;
    _agenda := _job.schedule;

    PERFORM cron.unschedule(_job.jobid);
    PERFORM cron.schedule(_job.jobname, _agenda, format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cmd$, _url,
      'REPLACE_WITH_NEW_SUPABASE_ANON_JWT'));
  END LOOP;
END $$;

COMMIT;
