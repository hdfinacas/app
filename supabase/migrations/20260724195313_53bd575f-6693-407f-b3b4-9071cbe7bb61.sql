
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  cpf text,
  email text,
  amount_requested numeric,
  income_monthly numeric,
  purpose text,
  term_months int,
  stage text NOT NULL DEFAULT 'new',
  score int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary text,
  last_message_at timestamptz,
  next_followup_at timestamptz,
  converted_client_id uuid,
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_user_phone_uniq ON public.leads(user_id, phone);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON public.leads(user_id, stage);
CREATE INDEX IF NOT EXISTS leads_followup_idx ON public.leads(user_id, next_followup_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_owner_all" ON public.leads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.leads_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_touch_updated_at();
