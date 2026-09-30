
-- Remove hardcoded shared default that leaks a shared WhatsApp key across tenants
ALTER TABLE public.settings ALTER COLUMN whatsapp_api_key DROP DEFAULT;

-- Neutralize any tenant that still has the shared default value stored
UPDATE public.settings
SET whatsapp_api_key = NULL
WHERE whatsapp_api_key = '429683C4C977415CAAFCCE10F7D57E11';

-- Hubla foi descontinuado: apagar o token user-writable para evitar forjar webhooks
UPDATE public.settings SET hubla_webhook_token = NULL WHERE hubla_webhook_token IS NOT NULL;
