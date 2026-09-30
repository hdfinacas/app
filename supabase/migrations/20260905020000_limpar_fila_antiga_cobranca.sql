-- Vincula a fila histórica à conversa. Só classificamos como cobrança quando o
-- próprio texto contém termos financeiros inequívocos; mensagens manuais comuns
-- continuam intocadas.
UPDATE public.whatsapp_scheduled_messages m
SET client_id = c.client_id,
    purpose = CASE
      WHEN m.text = 'Atendimento encerrado por falta de resposta. Quando precisar continuar, envie uma nova mensagem para abrir o menu novamente.' THEN 'session_timeout'
      WHEN m.text ~* '(parcela|pagamento|vencimento|em atraso|saldo devedor|chave pix|regularizar)' THEN 'collection'
      ELSE m.purpose
    END
FROM public.whatsapp_conversations c
WHERE c.id = m.conversation_id
  AND c.user_id = m.user_id
  AND m.status IN ('pending','processing')
  AND (m.client_id IS NULL OR m.purpose = 'manual');

UPDATE public.whatsapp_scheduled_messages m
SET status = 'cancelled', error = 'historical_debt_no_longer_exists'
WHERE m.status IN ('pending','processing')
  AND m.purpose = 'collection'
  AND m.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.contract_installments i
    JOIN public.contracts c ON c.id=i.contract_id AND c.user_id=i.user_id
    WHERE i.client_id=m.client_id AND i.user_id=m.user_id
      AND i.status NOT IN ('paid','cancelled')
      AND coalesce(i.amount,0)-coalesce(i.paid_amount,0)>0.009
      AND c.status IN ('active','overdue')
  );
