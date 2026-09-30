BEGIN;

-- ============================================================================
-- Sobrou uma rotina de cobrança duplicada, e ela só sabe falhar.
--
-- Existem DUAS chamando `auto-collection`:
--   • `auto-collection-hourly` (de hora em hora) — a boa, criada na migration
--     de 01/08 que passou a exigir `x-cron-secret`.
--   • `auto-collection-daily` (todo dia às 12:00) — sobra da migration de
--     abril. Aquela migration de 01/08 removeu as antigas pelo nome, e esta
--     ficou de fora da lista.
--
-- O comando dela não manda `x-cron-secret`. Desde que a função passou a exigir
-- o segredo, toda execução ao meio-dia leva 401. O `cron.job_run_details` diz
-- "succeeded" porque o que teve sucesso foi o `net.http_post` — a resposta HTTP
-- ninguém olha. Ou seja: uma rotina falhando em silêncio há dias.
--
-- Mesmo se mandasse o segredo, seria trabalho repetido: a de hora em hora já
-- cobre o meio-dia.
--
-- Nada se perde ao remover — a régua de cobrança continua com a horária.
-- ============================================================================

DO $$
DECLARE
  _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'auto-collection-daily';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
    RAISE NOTICE 'auto-collection-daily removida (jobid %)', _jobid;
  END IF;
END $$;

COMMIT;
