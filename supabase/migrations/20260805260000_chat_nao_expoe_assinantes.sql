BEGIN;

-- ============================================================================
-- O chat interno mostrava cada assinante para todos os outros.
--
-- `list_public_profiles` devolvia TODOS os perfis para qualquer usuário logado.
-- Num SaaS vendido para pessoas que emprestam dinheiro — e que concorrem entre
-- si — isso significa que o assinante A via o nome do assinante B na lista de
-- pessoas e podia abrir conversa privada com ele.
--
-- Não dá para simplesmente fechar tudo: o dono da plataforma precisa falar com
-- os assinantes (suporte), e o assinante precisa conseguir responder.
--
-- Regra nova:
--   • admin da plataforma  → enxerga todo mundo, como antes;
--   • assinante            → enxerga a si mesmo e os admins.
--
-- Conversa já existente entre dois não-admins continua no banco; o que muda é
-- que a lista de pessoas deixa de sugerir um assinante para o outro. Hoje há
-- uma única conversa privada na base inteira, entre dois perfis que nem existem
-- mais — ou seja, nada em uso real se perde.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_public_profiles()
 RETURNS TABLE(id uuid, name text, avatar_url text, is_admin boolean, is_chat_blocked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.name, p.avatar_url, p.is_admin, p.is_chat_blocked
    FROM public.profiles p
   WHERE
     -- quem é admin continua vendo todos, para dar suporte
     EXISTS (SELECT 1 FROM public.profiles eu WHERE eu.id = auth.uid() AND eu.is_admin)
     -- os demais: só a si mesmos e os admins
     OR p.id = auth.uid()
     OR p.is_admin
$function$;

REVOKE ALL ON FUNCTION public.list_public_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;

COMMIT;
