BEGIN;

-- ============================================================================
-- A tabela de lucros não tinha NENHUMA chave estrangeira.
--
-- `transactions` já tem trava para cliente e contrato; `profits` não tinha para
-- nada. Por isso existem hoje 4 registros de lucro apontando para linhas que
-- não existem mais: 1 para uma parcela apagada e 3 para clientes apagados.
--
-- O dinheiro desses registros é real — o que se perdeu foi o vínculo. Então a
-- regra certa é ON DELETE SET NULL, nunca CASCADE: apagar um cliente não pode
-- apagar o lucro que ele gerou, senão o histórico financeiro do assinante
-- encolhe sozinho toda vez que ele limpa um cadastro.
--
-- `transactions.installment_id` estava na mesma situação (sem trava), embora
-- por sorte ainda não tenha nenhum órfão.
--
-- Antes de criar as travas é preciso limpar os ponteiros quebrados — o Postgres
-- recusa criar uma FK que os dados já violam. Os valores continuam nos livros.
-- ============================================================================

UPDATE public.profits p
   SET installment_id = NULL
 WHERE p.installment_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contract_installments i WHERE i.id = p.installment_id);

UPDATE public.profits p
   SET client_id = NULL
 WHERE p.client_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p.client_id);

UPDATE public.transactions t
   SET installment_id = NULL
 WHERE t.installment_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.contract_installments i WHERE i.id = t.installment_id);

ALTER TABLE public.profits
  ADD CONSTRAINT profits_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD CONSTRAINT profits_installment_id_fkey
      FOREIGN KEY (installment_id) REFERENCES public.contract_installments(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_installment_id_fkey
      FOREIGN KEY (installment_id) REFERENCES public.contract_installments(id) ON DELETE SET NULL;

COMMIT;
