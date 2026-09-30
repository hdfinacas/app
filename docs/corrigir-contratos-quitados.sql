-- ============================================================================
-- Correção: contratos com TODAS as parcelas pagas que continuam como "active".
--
-- Contexto (levantado em 2026-08-04): 35 contratos nessa situação, somando
-- R$ 63.273,20 de capital e R$ 19.220,61 de "lucro a receber". O painel conta
-- os dois como dinheiro na rua, então o capital emprestado aparece maior do que
-- é de verdade.
--
-- Causa: o caminho antigo de baixa fazia escritas separadas e nem sempre
-- concluía o contrato. O RPC atômico `pay_installment` (em produção desde
-- 2026-07-23) já conclui corretamente — nenhum caso novo apareceu depois disso.
-- Ou seja: isto é acerto de histórico, não conserto de bug ativo.
--
-- COMO USAR: rode o PASSO 1 e confira a lista. Só depois rode o PASSO 2.
-- Nada aqui apaga registro: apenas muda `status` de 'active' para 'completed'.
-- ============================================================================

-- ── PASSO 1 — CONFERIR (somente leitura) ────────────────────────────────────
-- Olhe a lista antes de mudar qualquer coisa. Se algum contrato aqui NÃO estiver
-- realmente quitado, pare: significa que existe outro problema por trás.
SELECT c.id,
       cl.name                              AS cliente,
       c.capital,
       c.total_interest                     AS juros_do_contrato,
       c.status                             AS status_atual,
       count(i.id)                          AS parcelas,
       count(i.id) FILTER (WHERE i.status = 'paid') AS pagas,
       max(i.paid_at)::date                 AS ultimo_pagamento
  FROM public.contracts c
  JOIN public.clients cl ON cl.id = c.client_id
  JOIN public.contract_installments i ON i.contract_id = c.id
 WHERE c.status IN ('active', 'overdue')
 GROUP BY c.id, cl.name, c.capital, c.total_interest, c.status
HAVING count(i.id) FILTER (WHERE i.status <> 'paid') = 0
 ORDER BY max(i.paid_at) DESC;

-- ── PASSO 2 — APLICAR ───────────────────────────────────────────────────────
-- Descomente o bloco abaixo para executar. Ele roda em transação: se o número
-- de linhas afetadas destoar do que você viu no passo 1, dá ROLLBACK sozinho.
/*
BEGIN;

UPDATE public.contracts c
   SET status = 'completed'
 WHERE c.status IN ('active', 'overdue')
   AND EXISTS     (SELECT 1 FROM public.contract_installments i WHERE i.contract_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM public.contract_installments i
                    WHERE i.contract_id = c.id AND i.status <> 'paid');

-- Confira o número antes de confirmar.
-- Esperado em 2026-08-04: 35 linhas.
SELECT 'contratos concluidos agora' AS resultado, count(*)
  FROM public.contracts WHERE status = 'completed';

COMMIT;   -- troque por ROLLBACK; se o número não bater
*/

-- ── Os outros achados do verificador, para tratar um a um ───────────────────
-- Estes são poucos e cada um pode ter explicação legítima (troco, acordo).
-- Confira caso a caso antes de mexer — NÃO existe correção em massa aqui.

-- (a) Parcelas pagas acima do devido — pode ser troco ou pagamento a maior:
SELECT i.id, cl.name AS cliente, i.installment_number, i.amount, i.late_fee, i.paid_amount, i.paid_at
  FROM public.contract_installments i
  JOIN public.clients cl ON cl.id = i.client_id
 WHERE i.status = 'paid'
   AND coalesce(i.paid_amount,0) > coalesce(i.amount,0) + coalesce(i.late_fee,0) + 0.01;

-- (b) Saldo zerado mas status ainda aberto — some dos relatórios de recebimento:
SELECT i.id, cl.name AS cliente, i.installment_number, i.amount, i.paid_amount, i.status
  FROM public.contract_installments i
  JOIN public.clients cl ON cl.id = i.client_id
 WHERE i.status <> 'paid'
   AND coalesce(i.paid_amount,0) >= coalesce(i.amount,0) - 0.01
   AND coalesce(i.amount,0) > 0;

-- (c) Contrato concluído com parcela ainda em aberto — o inverso do caso geral:
SELECT c.id, cl.name AS cliente, i.installment_number, i.status, i.due_date, i.amount
  FROM public.contracts c
  JOIN public.clients cl ON cl.id = c.client_id
  JOIN public.contract_installments i ON i.contract_id = c.id
 WHERE c.status = 'completed' AND i.status <> 'paid';
