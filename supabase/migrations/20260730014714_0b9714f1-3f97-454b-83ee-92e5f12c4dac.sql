ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_admin_columns;
UPDATE public.profiles SET is_admin = true WHERE id = 'ef731a0b-65c4-4044-aeb3-78d6435201df';
ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_admin_columns;