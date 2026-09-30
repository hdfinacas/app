BEGIN;

-- Logs de auditoria precisam ser evidência, não conteúdo que o próprio cliente
-- possa fabricar pela API. As edge functions usam service_role e as rotinas SQL
-- oficiais usam funções SECURITY DEFINER, portanto continuam registrando ações.
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

COMMIT;
