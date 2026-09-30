-- The old hosted database had a foreign key added outside tracked migrations.
-- Drop it before the next migration creates the canonical named constraints.
ALTER TABLE public.profits
  DROP CONSTRAINT IF EXISTS profits_client_id_fkey,
  DROP CONSTRAINT IF EXISTS profits_installment_id_fkey;
