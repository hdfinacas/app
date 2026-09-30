BEGIN;

-- ============================================================================
-- VAZAMENTO ENTRE ASSINANTES: `settings_safe` ignorava o isolamento.
--
-- A tabela `settings` tem RLS correto — `auth.uid() = user_id` — e testada ela
-- se comporta: um assinante enxerga 1 linha, a dele. Mas a tela de Configurações
-- não lê a tabela, lê esta VIEW. E view no Postgres roda com os privilégios de
-- quem a CRIOU (aqui, `postgres`), não de quem consulta, a menos que se diga o
-- contrário. Resultado: qualquer assinante logado lia as 6 linhas, uma por
-- assinante.
--
-- O que estava exposto de um assinante para outro: nome da empresa, CNPJ,
-- endereço, telefone, URL e nome da instância do WhatsApp, URL do webhook n8n,
-- toda a configuração do bot, a identidade visual do portal e o modelo de
-- contrato personalizado. A chave da API do WhatsApp não — a view sempre
-- expôs só um booleano dizendo se está configurada. A chave PIX também não,
-- porque não faz parte da view.
--
-- `security_invoker = true` faz a view avaliar o RLS com o usuário da consulta.
-- Nada muda para quem lê os próprios dados.
-- ============================================================================

ALTER VIEW public.settings_safe SET (security_invoker = true);

COMMIT;
