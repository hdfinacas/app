ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'completo';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_tier text;

UPDATE public.profiles SET plan_tier = 'completo' WHERE plan_tier IS NULL OR plan_tier NOT IN ('essencial','completo');

CREATE OR REPLACE FUNCTION public.protect_profile_admin_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_service_role boolean := (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role';
BEGIN
  IF _is_service_role THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := COALESCE(OLD.is_blocked, false);
    NEW.is_chat_blocked := COALESCE(OLD.is_chat_blocked, false);
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.subscription_expires_at := OLD.subscription_expires_at;
    NEW.subscription_type := OLD.subscription_type;
    NEW.plan_tier := OLD.plan_tier;
  END IF;
  RETURN NEW;
END;
$function$;