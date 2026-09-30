CREATE TABLE IF NOT EXISTS public.loan_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_presets_user_created
  ON public.loan_presets(user_id, created_at DESC);

ALTER TABLE public.loan_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own loan presets" ON public.loan_presets;
CREATE POLICY "users manage own loan presets" ON public.loan_presets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_presets TO authenticated;
GRANT ALL ON public.loan_presets TO service_role;
