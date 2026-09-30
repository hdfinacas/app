BEGIN;

-- ============================================================================
-- Faz o botão "Novos Cadastros" do painel do dono valer de verdade.
--
-- Antes ele só escondia a interface: o front deixava de mostrar a aba de criar
-- conta, mas quem chamasse `get_signup_checkout_url()` direto continuava
-- recebendo o link de pagamento. Agora a própria função respeita a chave.
--
-- Limite honesto: isto fecha o cadastro DENTRO do fluxo do app. A criação de
-- conta direto na API de Auth do Supabase é controlada por outra chave
-- (`disable_signup`, no painel: Authentication → Sign In / Providers). O texto
-- na tela de administração avisa sobre isso.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_signup_checkout_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(
           (SELECT ps.allow_new_registrations FROM public.platform_settings ps WHERE ps.id LIMIT 1),
           true
         )
    THEN COALESCE(
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
    ELSE NULL   -- cadastro fechado pelo dono do app
  END
$$;

REVOKE ALL ON FUNCTION public.get_signup_checkout_url() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_checkout_url() TO anon, authenticated;

COMMIT;
