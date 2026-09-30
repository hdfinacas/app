BEGIN;

-- ============================================================================
-- Erros de front-end em produção.
--
-- Hoje um erro de tela não deixa rastro: o ErrorBoundary mostra "Algo deu
-- errado", escreve no console do navegador do cliente e acabou. Como o código
-- é gerado direto na main sem revisão, o dono do app só descobre quando alguém
-- reclama — e sem saber em qual tela nem com qual mensagem.
--
-- Escrita liberada de propósito (inclusive anônima): o portal do cliente e o do
-- cobrador não têm sessão, e são justamente onde um erro passa despercebido.
-- Leitura é só para admin da plataforma.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_errors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                      -- nulo quando o erro é em rota pública
  rota        text        NOT NULL DEFAULT '',
  mensagem    text        NOT NULL,
  pilha       text,
  navegador   text,
  contexto    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_errors_mensagem_tamanho CHECK (char_length(mensagem) <= 2000),
  CONSTRAINT client_errors_pilha_tamanho    CHECK (pilha IS NULL OR char_length(pilha) <= 8000)
);

COMMENT ON TABLE public.client_errors IS
  'Erros de JavaScript capturados no navegador. Escrita aberta, leitura só para admin.';

CREATE INDEX IF NOT EXISTS client_errors_criado_em_idx ON public.client_errors (criado_em DESC);
CREATE INDEX IF NOT EXISTS client_errors_rota_idx      ON public.client_errors (rota, criado_em DESC);

GRANT INSERT ON public.client_errors TO anon, authenticated;
GRANT SELECT ON public.client_errors TO authenticated;
GRANT ALL    ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode registrar um erro, mas nunca ler os dos outros.
DROP POLICY IF EXISTS client_errors_insert ON public.client_errors;
CREATE POLICY client_errors_insert ON public.client_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS client_errors_admin_read ON public.client_errors;
CREATE POLICY client_errors_admin_read ON public.client_errors
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Sem UPDATE e sem DELETE: registro de erro não se edita, e a limpeza é feita
-- pelo `auto-cleanup`, que roda com service_role.

COMMIT;
