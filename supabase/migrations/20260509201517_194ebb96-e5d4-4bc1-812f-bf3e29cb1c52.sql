-- ATENCAO: havia um token em texto puro neste arquivo, num repositorio publico.
--
-- Era o webhook token da Hubla, gateway DESCONTINUADO (hoje o pagamento é só
-- Mercado Pago). O valor já foi zerado no banco pela migration 20260724192435,
-- e a coluna `hubla_webhook_token` nem existe mais em `settings` — ou seja, o
-- comando original nem rodaria mais.
--
-- A migration fica como registro histórico. O comando foi removido para o
-- segredo sair do código. O valor antigo continua no histórico do Git: se a
-- conta Hubla ainda existir, revogue o token por lá.
--
-- Comando original, sem o segredo:
--   UPDATE public.settings SET hubla_webhook_token = '<TOKEN_REMOVIDO>'
--    WHERE user_id = (SELECT id FROM auth.users LIMIT 1);

SELECT 1;  -- no-op: mantém a migration válida sem executar nada
