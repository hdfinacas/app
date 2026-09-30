-- O portal do cobrador recebe um token público. A autorização já limitava o
-- cliente atribuído, mas aceitava qualquer `_paid_total >= amount`, permitindo
-- inflar caixa/lucro por chamada direta ao RPC. Recalcula o saldo no servidor e
-- exige quitação exata, incluindo juros compostos, teto e pagamentos parciais.
CREATE OR REPLACE FUNCTION public.collector_register_payment(
  _token text, _installment_id uuid, _paid_total numeric,
  _method text DEFAULT 'dinheiro', _receipt_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _tok public.collector_tokens%rowtype; _collector public.collectors%rowtype;
  _inst public.contract_installments%rowtype; _prev numeric; _new numeric;
  _contractual numeric; _principal numeric; _interest numeric; _fees numeric;
  _new_principal numeric; _new_interest numeric; _new_fees numeric; _remaining integer;
  _daily_rate numeric; _cap_percent numeric; _days_late integer;
  _live_fee numeric; _expected_total numeric;
BEGIN
  SELECT * INTO _tok FROM public.collector_tokens
  WHERE token = btrim(coalesce(_token,'')) AND is_active LIMIT 1;
  IF _tok.id IS NULL THEN RAISE EXCEPTION 'token_invalido'; END IF;
  SELECT * INTO _collector FROM public.collectors WHERE id = _tok.collector_id;
  IF _collector.id IS NULL OR NOT _collector.is_active THEN RAISE EXCEPTION 'cobrador_inativo'; END IF;
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id FOR UPDATE;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'parcela_nao_encontrada'; END IF;
  IF _inst.user_id <> _tok.user_id THEN RAISE EXCEPTION 'parcela_de_outro_credor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.collector_assignments a
    WHERE a.collector_id = _tok.collector_id AND a.client_id = _inst.client_id
      AND a.user_id = _tok.user_id) THEN RAISE EXCEPTION 'cliente_nao_atribuido'; END IF;
  IF _inst.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'already_paid', true, 'new_money', 0); END IF;

  SELECT coalesce(nullif(c.daily_interest_percent, 0), 4), c.max_interest_cap_percent
    INTO _daily_rate, _cap_percent
  FROM public.contracts c
  WHERE c.id = _inst.contract_id AND c.user_id = _tok.user_id;
  _daily_rate := coalesce(_daily_rate, 4);
  _days_late := greatest(0, current_date - _inst.due_date::date);
  _live_fee := CASE WHEN _days_late = 0 THEN 0 ELSE
    round((_inst.amount * (power(1 + (_daily_rate / 100), _days_late) - 1))::numeric, 2)
  END;
  IF _cap_percent IS NOT NULL AND _cap_percent > 0 THEN
    _live_fee := least(_live_fee, round((_inst.amount * _cap_percent / 100)::numeric, 2));
  END IF;

  _prev := round(coalesce(_inst.paid_amount,0)::numeric,2);
  _paid_total := round(coalesce(_paid_total,0)::numeric,2);
  _expected_total := round((_inst.amount + _live_fee)::numeric, 2);
  IF _paid_total < _prev OR abs(_paid_total - _expected_total) > 0.01 THEN
    RAISE EXCEPTION 'valor_de_quitacao_invalido';
  END IF;
  IF _method NOT IN ('pix', 'dinheiro', 'transferencia') THEN RAISE EXCEPTION 'metodo_invalido'; END IF;
  IF _receipt_url IS NOT NULL AND length(_receipt_url) > 2048 THEN RAISE EXCEPTION 'comprovante_invalido'; END IF;

  _new := _paid_total - _prev; _contractual := least(_paid_total, _inst.amount);
  _principal := CASE WHEN _inst.amount > 0 THEN round(_inst.scheduled_principal * _contractual / _inst.amount,2) ELSE 0 END;
  _interest := round(_contractual - _principal,2); _fees := round(greatest(0,_paid_total-_inst.amount),2);
  _new_principal := _principal-coalesce(_inst.paid_principal,0);
  _new_interest := _interest-coalesce(_inst.paid_interest,0); _new_fees := _fees-coalesce(_inst.paid_fees,0);
  UPDATE public.contract_installments SET paid_amount=_paid_total, paid_principal=_principal,
    paid_interest=_interest, paid_fees=_fees, late_fee=_live_fee, payment_method=_method,
    receipt_url=coalesce(_receipt_url,receipt_url), status='paid', paid_at=now()
  WHERE id=_installment_id;
  IF _interest+_fees > 0 THEN
    INSERT INTO public.profits(user_id,amount,description,client_id,installment_id)
    VALUES(_tok.user_id,_interest+_fees,'Juros e encargos parcela #'||_inst.installment_number,
      _inst.client_id,_installment_id)
    ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL
    DO UPDATE SET amount=excluded.amount,description=excluded.description;
  END IF;
  INSERT INTO public.transactions(user_id,amount,type,category,description,client_id,contract_id,
    installment_id,principal_amount,interest_amount,fee_amount)
  VALUES(_tok.user_id,_new,'payment','installment_payment',
    'Pagamento parcela #'||_inst.installment_number||' recebido por '||_collector.name,
    _inst.client_id,_inst.contract_id,_installment_id,greatest(0,_new_principal),
    greatest(0,_new_interest),greatest(0,_new_fees));
  INSERT INTO public.collection_attempts(user_id,client_id,contract_id,installment_id,channel,message_preview)
  VALUES(_tok.user_id,_inst.client_id,_inst.contract_id,_installment_id,'manual',
    'Pagamento de '||_new::text||' via '||coalesce(_method,'-')||' por '||_collector.name);
  SELECT count(*) INTO _remaining FROM public.contract_installments
  WHERE contract_id=_inst.contract_id AND status<>'paid';
  IF _remaining=0 THEN UPDATE public.contracts SET status='completed' WHERE id=_inst.contract_id; END IF;
  RETURN jsonb_build_object('ok',true,'new_money',_new,'principal',_new_principal,
    'interest',_new_interest,'fees',_new_fees);
END;
$$;
REVOKE ALL ON FUNCTION public.collector_register_payment(text,uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collector_register_payment(text,uuid,numeric,text,text) TO anon, authenticated;
