-- Política única de atraso: juros diário composto de 4% a.d.
ALTER TABLE public.contracts ALTER COLUMN late_fee_percent SET DEFAULT 0;
ALTER TABLE public.contracts ALTER COLUMN daily_interest_percent SET DEFAULT 4;

UPDATE public.contracts SET late_fee_percent = 0, daily_interest_percent = 4;
UPDATE public.settings SET default_late_fee = 0, default_daily_interest = 4;

-- Recalcula juros acumulados das parcelas em atraso (composto 4% a.d.)
UPDATE public.contract_installments i
SET late_fee = ROUND((i.amount * (POWER(1.04, GREATEST(0, (CURRENT_DATE - i.due_date::date))) - 1))::numeric, 2)
WHERE i.status NOT IN ('paid','cancelled')
  AND i.due_date::date < CURRENT_DATE;