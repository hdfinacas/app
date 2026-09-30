-- Renovações são recebimentos recorrentes e não podem disputar a chave
-- única reservada ao lucro da quitação normal de uma parcela.
CREATE OR REPLACE FUNCTION public.normalize_interest_renewal_profit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.installment_id IS NOT NULL
     AND NEW.description LIKE 'Juros de renova%' THEN
    NEW.installment_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_interest_renewal_profit ON public.profits;
CREATE TRIGGER trg_normalize_interest_renewal_profit
BEFORE INSERT ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.normalize_interest_renewal_profit();
