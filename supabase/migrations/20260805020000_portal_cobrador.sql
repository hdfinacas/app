BEGIN;

-- ============================================================================
-- Portal do cobrador externo — fazendo a tela funcionar.
--
-- A página /cobrador-externo lia `collector_tokens`, `collectors`,
-- `collector_assignments` e `contract_installments` direto pelo cliente
-- anônimo. Todas essas tabelas têm política só para `authenticated` com
-- `auth.uid() = user_id` — ou seja, um visitante sem login lê VAZIO. Na prática:
--
--   • o token nunca era encontrado e todo acesso caía em "Token inválido";
--   • se passasse, a lista de clientes e parcelas viria vazia;
--   • o registro de pagamento afetava 0 linhas e ainda assim mostrava
--     "✓ Pagamento registrado!" para o cobrador.
--
-- O recurso está anunciado nos dois planos ("portal do cobrador") e nunca
-- funcionou. Aqui ele passa a existir do mesmo jeito que o portal do cliente:
-- funções SECURITY DEFINER validando o token, com a RLS das tabelas intacta.
-- ============================================================================

-- ── Entrada: token → cobrador, clientes atribuídos e parcelas ───────────────
CREATE OR REPLACE FUNCTION public.collector_login_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tok       public.collector_tokens%rowtype;
  _collector public.collectors%rowtype;
  _owner     jsonb;
  _branding  jsonb;
  _clientes  jsonb;
BEGIN
  IF _token IS NULL OR btrim(_token) = '' THEN RETURN NULL; END IF;

  SELECT * INTO _tok
    FROM public.collector_tokens
   WHERE token = btrim(_token) AND is_active
   LIMIT 1;
  IF _tok.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _collector FROM public.collectors WHERE id = _tok.collector_id;
  -- Cobrador desativado perde o acesso mesmo com token ainda ativo.
  IF _collector.id IS NULL OR _collector.is_active IS NOT TRUE THEN RETURN NULL; END IF;

  -- Só os clientes atribuídos a ESTE cobrador, com as parcelas de cada um.
  SELECT coalesce(jsonb_agg(payload ORDER BY payload->>'name'), '[]'::jsonb)
  INTO _clientes
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'name', c.name, 'phone', c.phone, 'whatsapp', c.whatsapp,
      'cpf_cnpj', c.cpf_cnpj, 'email', c.email, 'status', c.status, 'address', c.address,
      'installments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'installment_number', i.installment_number, 'amount', i.amount,
          'due_date', i.due_date, 'status', i.status, 'paid_at', i.paid_at,
          'paid_amount', i.paid_amount, 'late_fee', i.late_fee,
          'payment_method', i.payment_method, 'receipt_url', i.receipt_url,
          'contract_id', i.contract_id,
          'daily_interest_percent', ct.daily_interest_percent,
          'max_interest_cap_percent', ct.max_interest_cap_percent
        ) ORDER BY i.due_date ASC)
        FROM public.contract_installments i
        LEFT JOIN public.contracts ct ON ct.id = i.contract_id
        WHERE i.client_id = c.id AND i.user_id = _tok.user_id
      ), '[]'::jsonb)
    ) AS payload
    FROM public.collector_assignments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE a.collector_id = _tok.collector_id AND a.user_id = _tok.user_id
  ) t;

  SELECT jsonb_build_object('name', p.name, 'pix_key', p.pix_key,
                            'pix_key_type', p.pix_key_type, 'billing_message', p.billing_message)
    INTO _owner FROM public.profiles p WHERE p.id = _tok.user_id;

  SELECT jsonb_build_object('company_name', s.company_name, 'company_logo_url', s.company_logo_url,
                            'portal_primary_color', s.portal_primary_color)
    INTO _branding FROM public.settings s WHERE s.user_id = _tok.user_id LIMIT 1;

  RETURN jsonb_build_object(
    'collector', jsonb_build_object(
      'id', _collector.id, 'name', _collector.name, 'phone', _collector.phone,
      'email', _collector.email, 'city', _collector.city, 'state', _collector.state,
      'created_at', _collector.created_at
    ),
    'owner_id', _tok.user_id,
    'owner', coalesce(_owner, '{}'::jsonb),
    'branding', coalesce(_branding, '{}'::jsonb),
    'clients', _clientes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.collector_login_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collector_login_by_token(text) TO anon, authenticated;

-- ── Registro de pagamento pelo cobrador ─────────────────────────────────────
-- Mesma contabilidade do `pay_installment`: parcela + lucro + caixa + conclusão
-- do contrato, tudo numa transação. A diferença é a autorização: em vez de
-- `auth.uid()`, valida o token E exige que o cliente esteja atribuído a este
-- cobrador — ele não consegue mexer em parcela de cliente que não é dele.
CREATE OR REPLACE FUNCTION public.collector_register_payment(
  _token          text,
  _installment_id uuid,
  _paid_total     numeric,
  _method         text DEFAULT 'dinheiro',
  _receipt_url    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tok       public.collector_tokens%rowtype;
  _collector public.collectors%rowtype;
  _inst      public.contract_installments%rowtype;
  _contract  public.contracts%rowtype;
  _prev_paid numeric;
  _new_money numeric;
  _interest  numeric := 0;
  _remaining int;
BEGIN
  SELECT * INTO _tok FROM public.collector_tokens
   WHERE token = btrim(coalesce(_token,'')) AND is_active LIMIT 1;
  IF _tok.id IS NULL THEN RAISE EXCEPTION 'token_invalido'; END IF;

  SELECT * INTO _collector FROM public.collectors WHERE id = _tok.collector_id;
  IF _collector.id IS NULL OR _collector.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'cobrador_inativo';
  END IF;

  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  IF _inst.user_id <> _tok.user_id THEN RAISE EXCEPTION 'parcela_de_outro_credor'; END IF;

  -- O cliente precisa estar atribuído a este cobrador.
  IF NOT EXISTS (
    SELECT 1 FROM public.collector_assignments a
     WHERE a.collector_id = _tok.collector_id
       AND a.client_id = _inst.client_id
       AND a.user_id = _tok.user_id
  ) THEN
    RAISE EXCEPTION 'cliente_nao_atribuido';
  END IF;

  IF _paid_total IS NULL OR _paid_total <= 0 THEN RAISE EXCEPTION 'valor_invalido'; END IF;

  _prev_paid := COALESCE(_inst.paid_amount, 0);
  _new_money := round((_paid_total - _prev_paid)::numeric, 2);
  IF _new_money <= 0 THEN RAISE EXCEPTION 'valor_menor_que_o_ja_pago'; END IF;

  UPDATE public.contract_installments
     SET paid_amount    = _paid_total,
         payment_method = _method,
         receipt_url    = COALESCE(_receipt_url, receipt_url),
         status         = 'paid',
         paid_at        = now()
   WHERE id = _installment_id;

  SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
  IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
    _interest := round((_inst.amount * (_contract.total_interest / _contract.total_amount))::numeric, 2);
  END IF;

  IF _interest > 0 THEN
    INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
    VALUES (_tok.user_id, _interest,
            'Juros parcela #' || _inst.installment_number || ' (cobrador: ' || _collector.name || ')',
            _inst.client_id, _installment_id);
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, description, client_id, contract_id, installment_id)
  VALUES (_tok.user_id, _new_money, 'payment',
          'Pagamento parcela #' || _inst.installment_number || ' recebido por ' || _collector.name,
          _inst.client_id, _inst.contract_id, _installment_id);

  -- Rastro de quem recebeu — o credor precisa saber qual cobrador baixou.
  -- `channel` aceita apenas whatsapp/email/sms/pix_copy/manual (CHECK da tabela);
  -- recebimento em mãos é 'manual', e o nome do cobrador vai na descrição.
  INSERT INTO public.collection_attempts (user_id, client_id, contract_id, installment_id, channel, message_preview)
  VALUES (_tok.user_id, _inst.client_id, _inst.contract_id, _installment_id, 'manual',
          'Pagamento de ' || _new_money::text || ' via ' || coalesce(_method,'-') || ' por ' || _collector.name);

  SELECT count(*) INTO _remaining FROM public.contract_installments
   WHERE contract_id = _inst.contract_id AND status <> 'paid';
  IF _remaining = 0 THEN
    UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money, 'interest', _interest);
END;
$$;

REVOKE ALL ON FUNCTION public.collector_register_payment(text, uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collector_register_payment(text, uuid, numeric, text, text) TO anon, authenticated;

COMMIT;
