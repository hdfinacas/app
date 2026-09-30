-- Neutraliza parcelas antigas cujo contrato foi removido. Mantemos o registro
-- para auditoria, mas ele deixa imediatamente de entrar em qualquer cobrança.
UPDATE public.contract_installments i
SET status = 'cancelled'
WHERE i.status NOT IN ('paid', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = i.contract_id
      AND c.user_id = i.user_id
      AND c.status IN ('active', 'overdue')
  );

-- Se um contrato for encerrado ou cancelado, nenhuma parcela ainda aberta pode
-- permanecer disponível para o agente, cron, portal ou geração de PIX.
CREATE OR REPLACE FUNCTION public.stop_charges_for_closed_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('active', 'overdue')
     AND NEW.status NOT IN ('active', 'overdue') THEN
    UPDATE public.contract_installments
       SET status = 'cancelled'
     WHERE contract_id = NEW.id
       AND status NOT IN ('paid', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stop_charges_for_closed_contract ON public.contracts;
CREATE TRIGGER trg_stop_charges_for_closed_contract
AFTER UPDATE OF status ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.stop_charges_for_closed_contract();
