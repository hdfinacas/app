-- Accounts are provisioned by an administrator in this application.
-- Keep any historical checkout fields empty and remove the public URL function.
DROP FUNCTION IF EXISTS public.get_signup_checkout_url();

UPDATE public.platform_settings
SET checkout_url = NULL
WHERE checkout_url IS NOT NULL;

UPDATE public.settings
SET hubla_checkout_url = NULL,
    mercadopago_checkout_url = NULL
WHERE hubla_checkout_url IS NOT NULL
   OR mercadopago_checkout_url IS NOT NULL;

SELECT cron.unschedule('auto-subscription-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-subscription-daily'
);
