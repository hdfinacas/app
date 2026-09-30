-- Repara pagamentos integrais cujo saldo foi zerado, mas o status permaneceu
-- pending/overdue por fluxos antigos. Esses registros não podem voltar à régua.
UPDATE public.contract_installments
SET status = 'paid',
    paid_at = coalesce(paid_at, now())
WHERE status NOT IN ('paid', 'cancelled')
  AND coalesce(amount, 0) > 0
  AND coalesce(paid_amount, 0) >= coalesce(amount, 0);

-- Se não existe nenhuma parcela com saldo, o contrato também deve permanecer
-- encerrado. A verificação de saldo protege inclusive status legados incorretos.
UPDATE public.contracts c
SET status = 'completed'
WHERE c.status NOT IN ('completed', 'cancelled')
  AND EXISTS (
    SELECT 1 FROM public.contract_installments i WHERE i.contract_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.contract_installments i
    WHERE i.contract_id = c.id
      AND i.status <> 'cancelled'
      AND greatest(0, coalesce(i.amount, 0) - coalesce(i.paid_amount, 0)) > 0.009
  );

-- Mantém a consistência nos próximos pagamentos, mesmo se algum cliente antigo
-- ainda usar uma tela/integração que atualize paid_amount sem atualizar status.
CREATE OR REPLACE FUNCTION public.sync_paid_installment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('paid', 'cancelled')
     AND coalesce(NEW.amount, 0) > 0
     AND coalesce(NEW.paid_amount, 0) >= coalesce(NEW.amount, 0) THEN
    NEW.status := 'paid';
    NEW.paid_at := coalesce(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_paid_installment_status ON public.contract_installments;
CREATE TRIGGER trg_sync_paid_installment_status
BEFORE INSERT OR UPDATE OF amount, paid_amount, status
ON public.contract_installments
FOR EACH ROW EXECUTE FUNCTION public.sync_paid_installment_status();
