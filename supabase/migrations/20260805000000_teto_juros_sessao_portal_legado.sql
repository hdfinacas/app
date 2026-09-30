BEGIN;

-- ============================================================================
-- 1. Teto de juros no portal do cliente
--    O portal calcula o valor devido no navegador, a partir do que a RPC manda.
--    Como `max_interest_cap_percent` não ia no payload, o devedor via um valor
--    sem teto mesmo em contrato que tem teto definido.
-- 2. Sessão do portal: 30 dias -> 48 horas
-- 3. Tabela `installments` legada
-- ============================================================================

-- ── 1. Portal passa a receber o teto do contrato ────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_login_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_id uuid;
  _client public.clients%rowtype;
  _contracts jsonb;
  _owner jsonb;
  _branding jsonb;
BEGIN
  IF _token IS NULL THEN RETURN NULL; END IF;

  SELECT client_id INTO _client_id
    FROM public.portal_sessions
   WHERE token = _token AND expires_at > now()
   LIMIT 1;

  IF _client_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _client FROM public.clients WHERE id = _client_id;
  IF _client.id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(contract_payload ORDER BY (contract_payload->>'created_at')::timestamptz DESC), '[]'::jsonb)
  INTO _contracts
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'capital', c.capital, 'interest_rate', c.interest_rate,
      'num_installments', c.num_installments, 'installment_amount', c.installment_amount,
      'frequency', c.frequency, 'start_date', c.start_date, 'status', c.status,
      'total_amount', c.total_amount, 'total_interest', c.total_interest,
      'payment_method', c.payment_method, 'created_at', c.created_at,
      'late_fee_percent', c.late_fee_percent,
      'daily_interest_percent', c.daily_interest_percent,
      'max_interest_cap_percent', c.max_interest_cap_percent,
      'installments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'installment_number', i.installment_number, 'amount', i.amount,
          'due_date', i.due_date, 'paid_at', i.paid_at, 'paid_amount', i.paid_amount,
          'late_fee', i.late_fee, 'status', i.status, 'payment_method', i.payment_method,
          'receipt_url', i.receipt_url,
          'late_fee_percent', c.late_fee_percent,
          'daily_interest_percent', c.daily_interest_percent,
          'max_interest_cap_percent', c.max_interest_cap_percent
        ) ORDER BY i.installment_number ASC, i.due_date ASC)
        FROM public.contract_installments i
        WHERE i.contract_id = c.id AND i.client_id = _client.id
      ), '[]'::jsonb)
    ) AS contract_payload
    FROM public.contracts c WHERE c.client_id = _client.id
  ) payload;

  SELECT jsonb_build_object('name', p.name, 'pix_key', p.pix_key, 'pix_key_type', p.pix_key_type)
  INTO _owner FROM public.profiles p WHERE p.id = _client.user_id;

  SELECT jsonb_build_object(
    'portal_title', s.portal_title, 'portal_subtitle', s.portal_subtitle,
    'portal_welcome_message', s.portal_welcome_message, 'portal_primary_color', s.portal_primary_color,
    'portal_contact_phone', s.portal_contact_phone, 'portal_contact_email', s.portal_contact_email,
    'portal_logo_url', s.portal_logo_url, 'company_name', s.company_name, 'company_logo_url', s.company_logo_url
  ) INTO _branding FROM public.settings s WHERE s.user_id = _client.user_id LIMIT 1;

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', _client.id, 'name', _client.name, 'email', _client.email,
      'phone', _client.phone, 'whatsapp', _client.whatsapp,
      'cpf_cnpj', _client.cpf_cnpj, 'status', _client.status, 'birth_date', _client.birth_date
    ),
    'contracts', _contracts,
    'owner', coalesce(_owner, '{}'::jsonb),
    'branding', coalesce(_branding, '{}'::jsonb),
    'session_token', _token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_login_by_token(uuid) TO anon, authenticated;

-- ── 2. Sessão do portal: de 30 dias para 48 horas ───────────────────────────
-- O token vai por WhatsApp, dentro de uma URL, e abre o dossiê financeiro
-- completo do devedor. Valendo 720 horas, encaminhar a mensagem entrega o
-- acesso junto — e o link continua funcionando um mês depois.
ALTER TABLE public.portal_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');

-- Encurta as sessões já emitidas que ainda estão em aberto. Quem estiver com o
-- portal aberto agora não é deslogado: só perde a validade de longuíssimo prazo.
UPDATE public.portal_sessions
   SET expires_at = LEAST(expires_at, now() + interval '48 hours')
 WHERE expires_at > now() + interval '48 hours';

-- ── 3. Tabela `installments` legada ─────────────────────────────────────────
-- Substituída por `contract_installments` e sem nenhuma referência no código.
-- NÃO é apagada aqui: renomear preserva o dado e deixa reversível com um
-- comando. Se em 30 dias nada quebrar, aí sim pode cair.
DO $$
BEGIN
  IF to_regclass('public.installments') IS NOT NULL
     AND to_regclass('public.installments_legado_20260805') IS NULL THEN
    ALTER TABLE public.installments RENAME TO installments_legado_20260805;
    COMMENT ON TABLE public.installments_legado_20260805 IS
      'Legado, substituída por contract_installments. Renomeada em 2026-08-05. Se nada quebrar até 2026-09-05, pode ser removida.';
  END IF;
END $$;

COMMIT;
