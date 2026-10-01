-- The core baseline enabled RLS on clients but did not add an owner policy.
-- Each signed-in account must be able to manage only its own client records.
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
