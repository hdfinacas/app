
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS agent_state text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS agent_state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS agent_state_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_conv_agent_state
  ON public.whatsapp_conversations(user_id, agent_state);

CREATE INDEX IF NOT EXISTS idx_ci_open_due
  ON public.contract_installments(user_id, due_date)
  WHERE status <> 'paid';

CREATE INDEX IF NOT EXISTS idx_wa_msg_client_created
  ON public.whatsapp_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_actions_user_created
  ON public.bot_actions_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs(user_id, created_at DESC);
