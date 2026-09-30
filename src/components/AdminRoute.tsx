import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Barreira de navegação do painel da plataforma.
 *
 * A autorização real continua no Supabase (RLS/RPC). Esta camada impede que
 * componentes administrativos sejam montados e consultem dados antes de a
 * permissão autoritativa do banco estar resolvida.
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isPlatformAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Verificando permissões">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
        <span className="sr-only">Verificando permissões…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
