BEGIN;

-- ============================================================================
-- Mais padrões de empréstimo, para o assinante configurar uma vez só.
--
-- Hoje só três coisas vinham preenchidas ao criar um empréstimo: taxa de juros,
-- juros de atraso e frequência. Número de parcelas, forma de pagamento e teto
-- de juros eram digitados de novo a cada contrato — e é sempre o mesmo valor
-- para a maioria dos casos.
--
-- O teto merece nota: `contracts.max_interest_cap_percent` existe desde maio e
-- limita quanto os juros de atraso podem crescer, mas dos 249 contratos da base
-- NENHUM tem o campo preenchido. Não é escolha do assinante — é que o campo só
-- aparece nas "condições avançadas" de cada empréstimo, uma tela que quase
-- ninguém abre. Como padrão, ele passa a valer para todo contrato novo.
--
-- `default_term_months` entra porque três lugares do whatsapp-webhook já leem
-- essa coluna para montar proposta de empréstimo pelo bot; como ela não existia,
-- caíam sempre no 6 fixo, ignorando o prazo que o assinante trabalha.
-- ============================================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS default_num_installments  integer,
  ADD COLUMN IF NOT EXISTS default_payment_method    text,
  ADD COLUMN IF NOT EXISTS default_max_interest_cap  numeric,
  ADD COLUMN IF NOT EXISTS default_term_months       integer;

COMMENT ON COLUMN public.settings.default_num_installments IS
  'Quantidade de parcelas que vem preenchida ao criar um empréstimo.';
COMMENT ON COLUMN public.settings.default_payment_method IS
  'Forma de pagamento padrão: pix, cash, boleto ou transfer.';
COMMENT ON COLUMN public.settings.default_max_interest_cap IS
  'Teto dos juros de atraso, em % sobre o valor da parcela. Vazio = sem teto.';
COMMENT ON COLUMN public.settings.default_term_months IS
  'Prazo padrão em meses, usado pelo bot ao montar proposta de empréstimo.';

-- Entram no fim da lista da view: CREATE OR REPLACE VIEW recusa coluna no meio.
CREATE OR REPLACE VIEW public.settings_safe AS
 SELECT id,
    user_id,
    created_at,
    company_name,
    company_cnpj,
    company_logo_url,
    favicon_url,
    primary_color,
    accent_color,
    theme_mode,
    sidebar_style,
    login_title,
    login_subtitle,
    footer_text,
    border_radius,
    font_family,
    default_interest_rate,
    default_late_fee,
    default_daily_interest,
    default_frequency,
    whatsapp_api_url,
    whatsapp_instance,
    whatsapp_api_key IS NOT NULL AND length(whatsapp_api_key) > 0 AS whatsapp_api_key_configured,
    n8n_webhook_url,
    push_notifications_enabled,
    bot_enabled,
    bot_auto_send,
    bot_send_hour,
    bot_send_minute,
    bot_max_messages_per_day,
    bot_work_days,
    bot_escalation_rules,
    bot_retry_interval_hours,
    bot_stop_on_payment,
    bot_notify_owner,
    bot_greeting_message,
    bot_closing_message,
    bot_send_pix,
    bot_send_receipt,
    bot_tone,
    bot_use_ai,
    bot_negotiation_enabled,
    bot_send_audio,
    bot_process_audio,
    bot_process_receipts,
    bot_auto_confirm_payment,
    bot_business_hours_only,
    bot_business_start,
    bot_business_end,
    portal_title,
    portal_subtitle,
    portal_welcome_message,
    portal_primary_color,
    portal_logo_url,
    portal_contact_phone,
    portal_contact_email,
    custom_contract_template,
    modules_enabled,
    company_address,
    company_phone,
    portal_require_birth_date,
    default_num_installments,
    default_payment_method,
    default_max_interest_cap,
    default_term_months
   FROM settings s;

COMMIT;
