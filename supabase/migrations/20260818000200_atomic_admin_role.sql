BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_user_admin(
  _target_user_id uuid,
  _make_admin boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _target_user_id = auth.uid() AND NOT _make_admin THEN
    RAISE EXCEPTION 'Você não pode remover sua própria permissão de administrador';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE public.profiles
     SET is_admin = _make_admin
   WHERE id = _target_user_id;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
     WHERE user_id = _target_user_id
       AND role = 'admin'::public.app_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_admin(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) TO authenticated;

COMMIT;
