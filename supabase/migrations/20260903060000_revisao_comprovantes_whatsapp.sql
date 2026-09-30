CREATE TABLE IF NOT EXISTS public.whatsapp_receipt_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  installment_id uuid REFERENCES public.contract_installments(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  media_hash text,
  match_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_receipt_review_hash
ON public.whatsapp_receipt_reviews(user_id, media_hash)
WHERE media_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_receipt_reviews_queue
ON public.whatsapp_receipt_reviews(user_id, status, created_at DESC);

ALTER TABLE public.whatsapp_receipt_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own receipt reviews" ON public.whatsapp_receipt_reviews;
CREATE POLICY "users manage own receipt reviews"
ON public.whatsapp_receipt_reviews FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_receipt_reviews TO authenticated;
GRANT ALL ON public.whatsapp_receipt_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.approve_whatsapp_receipt(_review_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _review public.whatsapp_receipt_reviews%rowtype;
  _result jsonb;
BEGIN
  SELECT * INTO _review FROM public.whatsapp_receipt_reviews
  WHERE id = _review_id AND user_id = auth.uid() FOR UPDATE;
  IF _review.id IS NULL THEN RAISE EXCEPTION 'receipt_review_not_found'; END IF;
  IF _review.status = 'approved' THEN RETURN jsonb_build_object('ok', true, 'already_approved', true); END IF;
  IF _review.status = 'rejected' THEN RAISE EXCEPTION 'receipt_review_rejected'; END IF;
  IF _review.installment_id IS NULL THEN RAISE EXCEPTION 'installment_not_identified'; END IF;

  _result := public.pay_installment(_review.installment_id, _review.amount, true, 'pix', NULL);
  UPDATE public.whatsapp_receipt_reviews SET
    status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = _review.id;
  RETURN _result || jsonb_build_object('review_id', _review.id);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_whatsapp_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_whatsapp_receipt(uuid) TO authenticated;
