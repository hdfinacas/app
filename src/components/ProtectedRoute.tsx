import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AlertCircle, Lock, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPortalSession } from "@/lib/portalSession";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { CredinhoLoader } from "@/components/brand/Credinho";

type ProtectedRouteProps = { children: React.ReactNode };

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, profile, isPlatformAdmin, loading, authError, retryAuth } = useAuth();
  const location = useLocation();
  const { settings: platform } = usePlatformSettings();
  const [retrying, setRetrying] = useState(false);

  if (hasPortalSession()) return <Navigate to="/portal-cliente" replace />;

  if (loading) return <CredinhoLoader fullScreen label="Verificando acesso" />;

  if (!user && !authError) {
    const path = location.pathname + location.search + location.hash;
    const lower = location.pathname.toLowerCase();
    const isAuthRoute = lower === "/" || lower.startsWith("/login") || lower.startsWith("/reset-password") ||
      lower.startsWith("/portal-cliente") || lower.startsWith("/cobrador-externo");
    const next = !isAuthRoute && path.startsWith("/") ? `?next=${encodeURIComponent(path)}` : "";
    return <Navigate to={`/login${next}`} replace />;
  }

  if (profile?.is_blocked) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="text-destructive" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Conta bloqueada</h1>
          <p className="text-sm text-muted-foreground">Sua conta foi bloqueada pelo administrador. Entre em contato para mais informa??es.</p>
        </div>
      </div>
    );
  }

  if (platform.maintenance_mode && !isPlatformAdmin && !profile?.is_admin) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <Wrench className="text-warning" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Sistema em manuten??o</h1>
          <p className="text-sm text-muted-foreground">{platform.maintenance_message?.trim() || "Estamos fazendo uma manuten??o r?pida. Volte em alguns minutos."}</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertCircle className="text-warning" size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">N?o foi poss?vel verificar seu acesso</h1>
            <p className="text-sm text-muted-foreground">{authError}</p>
          </div>
          <button
            disabled={retrying}
            onClick={() => { setRetrying(true); retryAuth(); window.setTimeout(() => setRetrying(false), 1500); }}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {retrying ? "Tentando novamente?" : "Tentar novamente"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
