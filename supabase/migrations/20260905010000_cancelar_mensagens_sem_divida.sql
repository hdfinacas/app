ALTER TABLE public.whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES public.contract_installments(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.whatsapp_scheduled_messages ADD CONSTRAINT whatsapp_scheduled_purpose_check
    CHECK (purpose IN ('manual','collection','service_followup','session_timeout'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_client_pending
  ON public.whatsapp_scheduled_messages(client_id, status)
  WHERE status IN ('pending','processing');

CREATE OR REPLACE FUNCTION public.cancel_scheduled_charges_after_installment_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE remaining_count integer;
BEGIN
  IF NEW.status IN ('paid','cancelled') OR coalesce(NEW.paid_amount,0) >= coalesce(NEW.amount,0) THEN
    SELECT count(*) INTO remaining_count
    FROM public.contract_installments i
    JOIN public.contracts c ON c.id=i.contract_id AND c.user_id=i.user_id
    WHERE i.client_id=NEW.client_id AND i.id<>NEW.id
      AND i.status NOT IN ('paid','cancelled')
      AND coalesce(i.amount,0)-coalesce(i.paid_amount,0)>0.009
      AND c.status IN ('active','overdue');
    IF remaining_count=0 THEN
      UPDATE public.whatsapp_scheduled_messages SET status='cancelled', error='debt_settled'
      WHERE client_id=NEW.client_id AND purpose IN ('collection','service_followup')
        AND status IN ('pending','processing');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_scheduled_charges_after_payment ON public.contract_installments;
CREATE TRIGGER trg_cancel_scheduled_charges_after_payment
AFTER UPDATE OF status, paid_amount ON public.contract_installments
FOR EACH ROW EXECUTE FUNCTION public.cancel_scheduled_charges_after_installment_change();
