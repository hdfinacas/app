BEGIN;

-- O painel de diagnóstico da plataforma precisa enxergar a trilha global.
-- Usuários comuns continuam limitados pela política original ao próprio tenant.
DROP POLICY IF EXISTS audit_logs_platform_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_platform_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
