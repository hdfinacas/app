BEGIN;

-- ============================================================================
-- Login do portal volta a ser por CPF, por decisão do dono do sistema.
--
-- Em 01/08 às 19:06 o login passou a exigir CPF + data de nascimento. A data
-- não existia em nenhum formulário de cliente — só na importação por planilha
-- — então os 120 clientes ficaram sem nenhum com o campo preenchido. A última
-- sessão do portal é de 01/08 às 18:21, 45 minutos antes da mudança: de lá
-- para cá ninguém conseguiu entrar.
--
-- Fica registrado o que isso custa: CPF no Brasil não é segredo. Quem souber o
-- CPF de um cliente vê a dívida dele, os contratos, os valores e a chave PIX
-- do credor. A data de nascimento continua aceita e ainda é conferida quando
-- vem preenchida — quem cadastrar a data dos clientes recupera o segundo fator
-- sem precisar de outra migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.portal_client_login(_cpf text, _birth_date date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client public.clients%rowtype;
  _contracts jsonb;
  _owner jsonb;
  _branding jsonb;
  _token uuid;
BEGIN
  IF length(_clean_cpf) < 11 THEN RETURN NULL; END IF;

  SELECT * INTO _client FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND (_birth_date IS NULL OR birth_date = _birth_date)
  ORDER BY created_at DESC LIMIT 1;

  IF _client.id IS NULL THEN RETURN NULL; END IF;

  DELETE FROM public.portal_sessions WHERE client_id = _client.id AND expires_at < now();
  INSERT INTO public.portal_sessions (client_id) VALUES (_client.id) RETURNING token INTO _token;

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
$function$
;

COMMIT;
