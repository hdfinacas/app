CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_key text PRIMARY KEY,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON public.webhook_events (created_at);

COMMENT ON TABLE public.webhook_events IS
  'Idempotency ledger for trusted provider webhooks. Accessible only by service_role.';
