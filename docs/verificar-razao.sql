-- ============================================================================
-- Verificação de consistência do razão financeiro — SOMENTE LEITURA.
--
-- Nada aqui altera dado: são contagens que respondem "os livros fecham?".
-- Rode no SQL editor do Supabase quando quiser auditar, e principalmente
-- DEPOIS de qualquer mudança no caminho de pagamento (`pay_installment` /
-- `reverse_installment_payment`).
--
-- Toda linha com quantidade > 0 merece olhada. Zero em tudo = razão íntegro.
-- ============================================================================

SELECT 'parcelas pagas sem valor pago' AS verificacao,
       count(*) AS quantidade,
       'status=paid mas paid_amount nulo ou zero — pagamento registrado sem dinheiro' AS o_que_significa
  FROM public.contract_installments
 WHERE status = 'paid' AND coalesce(paid_amount, 0) <= 0

UNION ALL
SELECT 'parcelas pagas a mais do que deviam',
       count(*),
       'paid_amount acima de amount + late_fee — troco ou lançamento duplicado'
  FROM public.contract_installments
 WHERE status = 'paid'
   AND coalesce(paid_amount, 0) > coalesce(amount, 0) + coalesce(late_fee, 0) + 0.01

UNION ALL
SELECT 'parcelas quitadas ainda em aberto',
       count(*),
       'saldo zerado mas status diferente de paid — some dos relatórios de recebimento'
  FROM public.contract_installments
 WHERE status <> 'paid'
   AND coalesce(paid_amount, 0) >= coalesce(amount, 0) - 0.01
   AND coalesce(amount, 0) > 0

UNION ALL
SELECT 'contratos concluídos com parcela em aberto',
       count(DISTINCT c.id),
       'contrato marcado completed mas ainda tem parcela não paga'
  FROM public.contracts c
  JOIN public.contract_installments i ON i.contract_id = c.id
 WHERE c.status = 'completed' AND i.status <> 'paid'

UNION ALL
SELECT 'contratos ativos com tudo pago',
       count(*),
       'todas as parcelas pagas mas o contrato não foi concluído — infla o capital na rua'
  FROM public.contracts c
 WHERE c.status IN ('active', 'overdue')
   AND NOT EXISTS (
         SELECT 1 FROM public.contract_installments i
          WHERE i.contract_id = c.id AND i.status <> 'paid')
   AND EXISTS (
         SELECT 1 FROM public.contract_installments i WHERE i.contract_id = c.id)

UNION ALL
SELECT 'lucros duplicados na mesma parcela',
       count(*),
       'mais de um lançamento de lucro para a mesma parcela — estorno incompleto'
  FROM (SELECT installment_id
          FROM public.profits
         WHERE installment_id IS NOT NULL
         GROUP BY installment_id
        HAVING count(*) > 1) d

UNION ALL
SELECT 'caixa duplicado na mesma parcela',
       count(*),
       'mais de um lançamento de caixa para a mesma parcela'
  FROM (SELECT installment_id
          FROM public.transactions
         WHERE installment_id IS NOT NULL
         GROUP BY installment_id
        HAVING count(*) > 1) d

UNION ALL
SELECT 'lucro órfão (parcela apagada)',
       count(*),
       'lucro aponta para parcela que não existe mais'
  FROM public.profits p
 WHERE p.installment_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contract_installments i WHERE i.id = p.installment_id)

UNION ALL
SELECT 'caixa órfão (parcela apagada)',
       count(*),
       'transação aponta para parcela que não existe mais'
  FROM public.transactions t
 WHERE t.installment_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contract_installments i WHERE i.id = t.installment_id)

UNION ALL
SELECT 'parcela de um dono com contrato de outro',
       count(*),
       'vazamento entre inquilinos: user_id da parcela difere do user_id do contrato'
  FROM public.contract_installments i
  JOIN public.contracts c ON c.id = i.contract_id
 WHERE i.user_id <> c.user_id

UNION ALL
SELECT 'parcela de um cliente com contrato de outro',
       count(*),
       'parcela ligada a um cliente que não é o do contrato'
  FROM public.contract_installments i
  JOIN public.contracts c ON c.id = i.contract_id
 WHERE i.client_id <> c.client_id

ORDER BY quantidade DESC, verificacao;
