# Configurar o primeiro administrador

Use este procedimento uma vez no projeto Supabase `apphd` (`asbylljmekwaovtzbqje`). Ele não cria um usuário por cadastro público nem altera a senha de uma conta existente.

## 1. Criar o usuário

No Dashboard do Supabase, abra **Authentication → Users → Add user** e crie a conta com o e-mail que será o administrador inicial. Defina a senha diretamente no painel e confirme o usuário.

## 2. Conceder a função de admin

No **SQL Editor**, substitua `ADMIN_EMAIL_AQUI` pelo e-mail exato criado acima e execute:

```sql
DO $$
DECLARE
  admin_email text := lower(trim('ADMIN_EMAIL_AQUI'));
  matching_ids uuid[];
  target_id uuid;
BEGIN
  SELECT array_agg(id)
    INTO matching_ids
    FROM auth.users
   WHERE lower(email) = admin_email;

  IF coalesce(array_length(matching_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente um usuário com esse e-mail';
  END IF;

  target_id := matching_ids[1];

  UPDATE public.profiles
     SET is_admin = true
   WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil ausente; nenhuma função de admin foi concedida';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
```

Confirme a função antes de entrar no app:

```sql
SELECT u.email, p.is_admin, r.role
  FROM auth.users AS u
  JOIN public.profiles AS p ON p.id = u.id
  LEFT JOIN public.user_roles AS r ON r.user_id = u.id AND r.role = 'admin'
 WHERE lower(u.email) = lower('ADMIN_EMAIL_AQUI');
```

O resultado deve mostrar `is_admin = true` e `role = admin`.

## 3. Configurar links de autenticação

Em **Authentication → URL Configuration**, defina:

- **Site URL:** `https://dhfinanceira.sbs`
- **Redirect URL:** `https://dhfinanceira.sbs/reset-password`
- Para desenvolvimento local, se necessário: `http://localhost:8080/reset-password`

## 4. Configurar integrações

Em **Edge Functions → Secrets**, adicione as chaves que serão usadas pelo app. A chave de IA é `ANTHROPIC_API_KEY`; para e-mail use `RESEND_API_KEY` ou `BREVO_API_KEY`. A URL base das funções deve ser `SITE_URL=https://dhfinanceira.sbs` e `APP_URL=https://dhfinanceira.sbs`.

Depois do primeiro login, configure a URL e a chave da Evolution no painel de WhatsApp do próprio usuário administrador; esses valores são guardados nas configurações desse usuário.
