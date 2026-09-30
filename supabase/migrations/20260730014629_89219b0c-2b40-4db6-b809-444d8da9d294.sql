CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT true FROM public.user_roles WHERE user_id = _user_id AND role = 'admin' LIMIT 1),
    (SELECT is_admin = true FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

UPDATE public.profiles SET is_admin = true WHERE id = 'ef731a0b-65c4-4044-aeb3-78d6435201df';