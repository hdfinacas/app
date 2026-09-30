-- A policy antiga consultava `auth.users` durante a leitura do assinante.
-- Usuários comuns não têm permissão direta nessa tabela, então uma conta sem
-- entitlement no perfil podia cair em "Não foi possível verificar seu acesso"
-- em vez de obter uma decisão normal. O e-mail já existe no JWT assinado.
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
