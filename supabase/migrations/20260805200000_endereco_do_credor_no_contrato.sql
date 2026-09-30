BEGIN;

-- ============================================================================
-- Endereço e telefone do credor, para o contrato.
--
-- O modelo de contrato só conseguia citar nome e CNPJ do credor. Um contrato de
-- empréstimo identifica as partes — e a qualificação de quem empresta inclui o
-- endereço. Sem coluna para guardar, não havia como o assinante preencher isso
-- uma vez e ver aparecer em todos os contratos.
--
-- Fica em `settings` junto do resto da identificação da empresa, e alimenta as
-- variáveis {{empresa_endereco}} e {{empresa_telefone}}.
-- ============================================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_phone   text;

COMMENT ON COLUMN public.settings.company_address IS
  'Endereço do credor, usado na qualificação das partes no contrato ({{empresa_endereco}}).';
COMMENT ON COLUMN public.settings.company_phone IS
  'Telefone do credor, usado no contrato ({{empresa_telefone}}).';

COMMIT;
