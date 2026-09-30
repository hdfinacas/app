BEGIN;

-- ============================================================================
-- Separação entre configuração da PLATAFORMA e configuração do ASSINANTE.
--
--   public.settings          -> uma linha por assinante (tenant). Marca, bot,
--                               portal, integrações. Continua como está.
--   public.platform_settings -> UMA linha só, do dono do app. Vale para todos.
--
-- Antes desta migration os "parâmetros globais" do /admin gravavam na linha de
-- `settings` do próprio admin (ou seja: não eram globais), e 4 dos 5 campos não
-- eram gravados em lugar nenhum.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  -- id fixo em `true` + CHECK garante que nunca exista mais de uma linha.
  id                      boolean     PRIMARY KEY DEFAULT true,
  maintenance_mode        boolean     NOT NULL DEFAULT false,
  maintenance_message     text,
  allow_new_registrations boolean     NOT NULL DEFAULT true,
  default_trial_days      integer     NOT NULL DEFAULT 3,
  global_announcement     text,
  checkout_url            text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid,
  CONSTRAINT platform_settings_singleton CHECK (id),
  CONSTRAINT platform_settings_trial_days_sane CHECK (default_trial_days BETWEEN 0 AND 365)
);

COMMENT ON TABLE public.platform_settings IS
  'Configuração global da plataforma (linha única). Só admin escreve; leitura é pública porque não guarda segredo.';

-- ── Semente: herda o link de checkout que já estava em uso ───────────────────
-- Contexto: `get_signup_checkout_url()` no banco lia `settings.hubla_checkout_url`,
-- coluna que NÃO EXISTE mais — então a função dava erro em toda chamada e o botão
-- "Criar conta" respondia "nenhum link de pagamento configurado". O painel, por sua
-- vez, gravava em `settings.mercadopago_checkout_url`, que ninguém lia.
-- Hubla foi descontinuado: daqui pra frente só Mercado Pago, num lugar só.
INSERT INTO public.platform_settings (id, checkout_url)
SELECT
  true,
  (
    SELECT NULLIF(btrim(s.mercadopago_checkout_url), '')
      FROM public.settings s
     WHERE NULLIF(btrim(s.mercadopago_checkout_url), '') IS NOT NULL
     ORDER BY s.created_at ASC
     LIMIT 1
  )
ON CONFLICT (id) DO NOTHING;

-- ── Permissões ──────────────────────────────────────────────────────────────
GRANT SELECT         ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL            ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Leitura liberada: a tela de login precisa saber se o cadastro está aberto e
-- qual é o link de checkout ANTES de existir sessão. Nenhum campo é secreto.
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Escrita só para admin da plataforma (user_roles.admin, com fallback para
-- profiles.is_admin — é o que public.is_admin() já resolve).
DROP POLICY IF EXISTS platform_settings_admin_insert ON public.platform_settings;
CREATE POLICY platform_settings_admin_insert ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS platform_settings_admin_update ON public.platform_settings;
CREATE POLICY platform_settings_admin_update ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Sem policy de DELETE: a linha única não pode ser apagada por ninguém via API.

-- ── Carimbo de auditoria + trava do singleton ───────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_settings_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.id         := true;      -- ignora qualquer tentativa de criar 2ª linha
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_touch ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_touch
  BEFORE INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_settings_touch();

-- ── Link de cadastro passa a sair da configuração da plataforma ─────────────
-- CORREÇÃO DE BUG EM PRODUÇÃO: a versão anterior referenciava
-- `settings.hubla_checkout_url`, coluna inexistente, e portanto lançava
-- "column does not exist" a cada chamada — quebrando o cadastro de novos clientes.
-- Agora lê a configuração da plataforma, com fallback para o link do Mercado Pago
-- que porventura esteja salvo em `settings`.
CREATE OR REPLACE FUNCTION public.get_signup_checkout_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(ps.checkout_url), '')
       FROM public.platform_settings ps
      WHERE ps.id
      LIMIT 1),
    (SELECT NULLIF(btrim(s.mercadopago_checkout_url), '')
       FROM public.settings s
      WHERE NULLIF(btrim(s.mercadopago_checkout_url), '') IS NOT NULL
      ORDER BY s.created_at ASC
      LIMIT 1)
  )
$$;

REVOKE ALL ON FUNCTION public.get_signup_checkout_url() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_checkout_url() TO anon, authenticated;

-- Comentário desatualizado: o gateway é Mercado Pago, Hubla saiu de cena.
-- Corpo inalterado — segue sem liberar trial automático.
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sem trial automático. O acesso exige assinatura ativa, concedida pelo
  -- webhook do Mercado Pago após a confirmação do pagamento.
  NEW.trial_ends_at := NULL;
  NEW.subscription_expires_at := NULL;
  RETURN NEW;
END;
$$;

COMMIT;
