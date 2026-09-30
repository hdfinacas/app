-- Um pagamento ao investidor gera uma saída no razão vinculada por
-- transactions.investor_payment_id. Se o empréstimo/investidor é excluído,
-- investor_payments cai em cascata; o lançamento correspondente precisa cair
-- junto. ON DELETE SET NULL deixava uma despesa órfã reduzindo a carteira.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_investor_payment_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_investor_payment_id_fkey
  FOREIGN KEY (investor_payment_id)
  REFERENCES public.investor_payments(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT transactions_investor_payment_id_fkey ON public.transactions IS
  'Mantém o razão sincronizado ao estornar/excluir pagamentos de investidores.';
