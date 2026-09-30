-- ============================================================================
-- Pagamentos lançados DUAS VEZES no caixa — 32 parcelas, 6 contratos,
-- R$ 5.715,00 contados a mais.
--
-- O QUE ACONTECEU
-- Em dois momentos — 29/05/26 18:16 (22 lançamentos) e 07/07/26 21:47 (6) —
-- parcelas foram marcadas como pagas em lote e o caixa recebeu uma entrada para
-- cada uma. Depois, conforme o cliente foi pagando de verdade, cada pagamento
-- entrou no caixa OUTRA VEZ, agora com a data real.
--
-- O caso mais claro é o contrato a2c557bc de MARIANA SANTOS CARDOSO: 24
-- parcelas, todas pagas, somando R$ 4.338 — e 48 lançamentos somando R$ 8.658.
-- Cada parcela aparece duas vezes, uma no lote de 29/05 e outra na data real.
--
-- POR QUE NÃO É ENGANO DE LEITURA
-- O par tem o MESMO contrato, a MESMA descrição ("Pagamento parcela #N") e o
-- MESMO valor. Uma parcela só pode ser paga uma vez; pagamento parcial seguido
-- de quitação teria valores diferentes.
--
-- O QUE ESTE ARQUIVO FAZ
-- Apaga o lançamento MAIS ANTIGO de cada par — o do lote — e mantém o da data
-- real do pagamento, que é o que descreve o fato.
--
-- ANTES DE RODAR
-- A lista exata das 32 linhas está em `lancamentos-duplicados-removidos-20260806.txt`,
-- com id, cliente, valor, data e descrição. Confira. Se algum caso ali for um
-- pagamento legítimo repetido, PARE — significa que a leitura está errada.
--
-- Rode o PASSO 1, confira o número, e só então o PASSO 2.
-- ============================================================================

-- ── PASSO 1 — CONFERIR (somente leitura) ────────────────────────────────────
WITH pares AS (
  SELECT contract_id, description, amount, min(created_at) AS primeiro
    FROM public.transactions
   WHERE type = 'payment' AND description LIKE 'Pagamento parcela #%'
   GROUP BY 1, 2, 3
  HAVING count(*) > 1
)
SELECT cl.name                                   AS cliente,
       t.amount,
       to_char(t.created_at, 'DD/MM/YY HH24:MI') AS lancado_em,
       t.description
  FROM public.transactions t
  JOIN pares p ON p.contract_id = t.contract_id
              AND p.description  = t.description
              AND p.amount       = t.amount
              AND t.created_at   = p.primeiro
  JOIN public.contracts c ON c.id = t.contract_id
  JOIN public.clients  cl ON cl.id = c.client_id
 ORDER BY cl.name, t.created_at;

-- ── PASSO 2 — APAGAR (só depois de conferir a lista acima) ──────────────────
-- Descomente para executar.
--
-- WITH pares AS (
--   SELECT contract_id, description, amount, min(created_at) AS primeiro
--     FROM public.transactions
--    WHERE type = 'payment' AND description LIKE 'Pagamento parcela #%'
--    GROUP BY 1, 2, 3
--   HAVING count(*) > 1
-- )
-- DELETE FROM public.transactions t
--  USING pares p
--  WHERE t.contract_id = p.contract_id
--    AND t.description  = p.description
--    AND t.amount       = p.amount
--    AND t.created_at   = p.primeiro;

-- ── PASSO 3 — CONFERIR O RESULTADO ──────────────────────────────────────────
-- O total do caixa deve cair exatamente R$ 5.715,00, e os contratos afetados
-- passam a ter caixa igual à soma das parcelas pagas.
--
-- SELECT count(*) AS lancamentos, round(sum(amount)::numeric, 2) AS total
--   FROM public.transactions WHERE type = 'payment';
