-- settings_safe deixa de rodar com permissões do criador (SECURITY DEFINER view).
ALTER VIEW public.settings_safe SET (security_invoker = true);

-- Com security_invoker, quem consulta precisa de SELECT na tabela base.
-- A RLS de settings ("Users manage own settings": auth.uid() = user_id) garante
-- que cada usuário só alcança a própria linha; nenhum dado de outro tenant é exposto.
GRANT SELECT ON public.settings TO authenticated;
GRANT SELECT ON public.settings_safe TO authenticated;