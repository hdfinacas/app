import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * O dono do app tem duas naturezas dentro do sistema:
 *
 *   "platform"  → painel do dono: usuários, assinaturas, suporte, automações,
 *                 logs e manutenção. NENHUMA tela de operação aparece.
 *   "operation" → o app normal de credor (clientes, contratos, cobranças),
 *                 igual ao que qualquer assinante enxerga.
 *
 * Quem não é admin de plataforma fica sempre em "operation" e nunca vê o seletor.
 */
export type AppMode = "platform" | "operation";

const STORAGE_KEY = "app-mode";

/** Prefixos que pertencem ao painel da plataforma. */
export const PLATFORM_PATHS = ["/admin", "/auditoria", "/historico"];

/** Telas que fazem sentido nos dois modos (conta do próprio usuário). */
export const NEUTRAL_PATHS = ["/perfil", "/sobre"];

const matches = (list: string[], pathname: string) =>
  list.some((p) => pathname === p || pathname.startsWith(p + "/"));

export const isPlatformPath = (pathname: string) => matches(PLATFORM_PATHS, pathname);
export const isNeutralPath = (pathname: string) => matches(NEUTRAL_PATHS, pathname);

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  /** true só quando o usuário pode alternar (ou seja, é admin da plataforma). */
  canSwitch: boolean;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: "operation",
  setMode: () => {},
  canSwitch: false,
});

export const useAppMode = () => useContext(AppModeContext);

function readStored(): AppMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "platform" || v === "operation" ? v : null;
  } catch {
    return null;
  }
}

export const AppModeProvider = ({ children }: { children: React.ReactNode }) => {
  const { isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  const [stored, setStored] = useState<AppMode | null>(() => readStored());
  const lastHandledPath = useRef<string | null>(null);

  const setMode = useCallback((next: AppMode) => {
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  // Entrar por uma URL do painel coloca o admin em modo plataforma. A troca só
  // acompanha uma MUDANÇA de rota: ao clicar em "Minha operação", o estado muda
  // enquanto a URL ainda é /admin por um instante. Reagir também à mudança de
  // `stored` nesse intervalo revertia o clique e prendia o dono no painel.
  useEffect(() => {
    if (loading || !isPlatformAdmin) return;
    const pathChanged = lastHandledPath.current !== location.pathname;
    lastHandledPath.current = location.pathname;
    if (pathChanged && isPlatformPath(location.pathname) && stored !== "platform") {
      setMode("platform");
    }
  }, [loading, isPlatformAdmin, location.pathname, stored, setMode]);

  const value = useMemo<AppModeContextType>(() => {
    // Sem permissão de plataforma não existe escolha: é sempre o app de operação.
    if (!isPlatformAdmin) return { mode: "operation", setMode, canSwitch: false };
    // Admin sem preferência salva começa no painel da plataforma.
    return { mode: stored ?? "platform", setMode, canSwitch: true };
  }, [isPlatformAdmin, stored, setMode]);

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};
