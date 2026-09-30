import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, MoreHorizontal,
  BarChart3, FileSignature, TrendingUp, DollarSign, Bot,
  Calculator, Target, CheckSquare, StickyNote, Table, Database,
  QrCode, ClipboardList, Shield, Settings, Crown, Info,
  UserCheck, FileText, X, Sparkles, MessageCircle,
  Plus, UserPlus, Wallet as WalletIcon, Smartphone, ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { usePlan } from "@/hooks/usePlan";

const PRO_PATHS = ["/comunicacao", "/comunicacao/inbox", "/agente-ia", "/automacoes", "/bot-performance"];

const mobileIconColor: Record<string, string> = {
  "/hoje": "text-amber-400",
  "/dashboard": "text-zinc-300",
  "/clientes": "text-zinc-300",
  "/cobrancas": "text-zinc-200",
  "/carteira": "text-zinc-300",
  "/analises": "text-zinc-400",
  "/relatorios": "text-zinc-300",
  "/cobradores": "text-slate-300",
  "/lucros": "text-emerald-400",
  "/gastos": "text-rose-400",
  "/garantias": "text-amber-300",
  "/agente-ia": "text-violet-400",
  "/ferramentas/simulador": "text-zinc-300",
  "/ferramentas/metas": "text-zinc-300",
  "/ferramentas/tarefas": "text-zinc-300",
  "/ferramentas/anotacoes": "text-slate-300",
  "/ferramentas/planilha": "text-zinc-300",
  "/puxada-dados": "text-zinc-300",
  "/qrcode": "text-zinc-300",
  "/historico": "text-slate-400",
  "/auditoria": "text-red-300",
  "/automacoes": "text-amber-400",
  "/configuracoes": "text-zinc-400",
  "/admin": "text-amber-300",
  "/sobre": "text-zinc-300",
  "/suporte": "text-pink-400",
  "/chat": "text-emerald-400",
};
const mobileIconTone: Record<string, string> = {
  "/hoje": "amber", "/dashboard": "blue", "/clientes": "orange", "/cobrancas": "rose", "/carteira": "emerald", "/comercial": "indigo", "/garantias": "yellow", "/analises": "violet", "/relatorios": "sky", "/cobradores": "lime", "/lucros": "green", "/gastos": "red", "/chat": "cyan", "/qrcode": "blue", "/configuracoes": "slate", "/suporte": "pink", "/admin": "amber",
};

const mainTabs = [
  { label: "Hoje", icon: Sparkles, path: "/hoje" },
  { label: "Cobranças", icon: Receipt, path: "/cobrancas" },
  { label: "Clientes", icon: Users, path: "/clientes" },
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

/** Barra do painel do dono do app — no celular substitui a de operação. */
const platformTabs = [
  { label: "Usuários", icon: Users, path: "/admin" },
  { label: "Suporte", icon: MessageCircle, path: "/admin?secao=support" },
  { label: "Logs", icon: ClipboardList, path: "/admin?secao=logs" },
  { label: "Sistema", icon: Settings, path: "/admin?secao=settings" },
  { label: "Perfil", icon: UserCheck, path: "/perfil" },
];

const moreGroups = [
  {
    title: "Análise",
    items: [
      { label: "Análises", icon: BarChart3, path: "/analises" },
      { label: "Relatórios", icon: FileText, path: "/relatorios" },
      
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "Carteira", icon: WalletIcon, path: "/carteira" },
      { label: "Comercial", icon: Smartphone, path: "/comercial" },
      { label: "Garantias", icon: ShieldCheck, path: "/garantias" },
      { label: "Lucros", icon: TrendingUp, path: "/lucros" },
      { label: "Gastos", icon: DollarSign, path: "/gastos" },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { label: "Atendimento", icon: Bot, path: "/comunicacao" },
      { label: "Conversas", icon: MessageCircle, path: "/comunicacao/inbox" },
      { label: "Chat interno", icon: MessageCircle, path: "/chat" },
    ],
  },
  {
    title: "Equipe & Portais",
    items: [
      { label: "Cobradores", icon: UserCheck, path: "/cobradores" },
      { label: "QR Code de acesso", icon: QrCode, path: "/qrcode" },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { label: "Simulador", icon: Calculator, path: "/ferramentas/simulador" },
      { label: "Metas", icon: Target, path: "/ferramentas/metas" },
      { label: "Tarefas", icon: CheckSquare, path: "/ferramentas/tarefas" },
      { label: "Anotações", icon: StickyNote, path: "/ferramentas/anotacoes" },
      { label: "Planilha", icon: Table, path: "/ferramentas/planilha" },
      { label: "Consulta CPF/CNPJ", icon: Database, path: "/puxada-dados" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
      { label: "Suporte", icon: Sparkles, path: "/suporte" },
      { label: "Histórico", icon: ClipboardList, path: "/historico" },
      { label: "Auditoria", icon: Shield, path: "/auditoria" },
      { label: "Admin", icon: Crown, path: "/admin" },
      { label: "Sobre", icon: Info, path: "/sobre" },
    ],
  },
];


const MobileBottomNav = () => {
  const location = useLocation();
  // Telas de preencher formulário: o botão flutuante atrapalha mais do que ajuda.
  const emFormulario = /^\/(clientes\/novo|configuracoes)/.test(location.pathname);
  const navigate = useNavigate();
  const { user, isPlatformAdmin } = useAuth();
  const { mode } = useAppMode();
  const [showMore, setShowMore] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const { hasAutomations } = usePlan();

  const fabActions = [
    { label: "Novo cliente", icon: UserPlus, onClick: () => navigate("/clientes/novo") },
    { label: "Cobrar agora", icon: WalletIcon, onClick: () => navigate("/cobrancas") },
    { label: "Nova anotação", icon: StickyNote, onClick: () => navigate("/ferramentas/anotacoes") },
  ];

  const isActive = (path: string) => {
    if (path === "__more__") return showMore;
    const [p, q] = path.split("?");
    const samePath = location.pathname === p || location.pathname.startsWith(p + "/");
    if (!samePath) return false;
    const current = new URLSearchParams(location.search).get("secao");
    if (!q) return !current;
    return current === new URLSearchParams(q).get("secao");
  };

  // Em modo plataforma a barra inteira vira o painel do dono do app.
  const isPlatformMode = mode === "platform";
  const visibleTabs = isPlatformMode ? platformTabs : mainTabs;

  const isInMoreSection = moreGroups.some((group) =>
    group.items.some(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/")
    )
  );

  return (
    <>
      {/* Menu "Mais" */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[28] animate-fade-in"
            onClick={() => setShowMore(false)}
          />
          <div className="mobile-more-sheet fixed left-0 right-0 z-[31] px-3 pb-2 animate-slide-up" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="glass-strong rounded-2xl border border-border/40 p-4 max-h-[70vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Menu Completo</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-5">
                {moreGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2.5 px-1">
                      {group.title}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {group.items
                        .filter((i) => (i.path !== "/admin" || isPlatformAdmin) && (hasAutomations || !PRO_PATHS.includes(i.path)))
                        .map((item) => {
                          const active = isActive(item.path);
                          return (
                            <button
                              key={item.path}
                              onClick={() => {
                                navigate(item.path);
                                setShowMore(false);
                              }}
                              className={`
                                flex flex-col items-center gap-1.5 p-3 rounded-xl
                                transition-all duration-200 active:scale-95
                                ${active
                                  ? "bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                                  : `${mobileIconColor[item.path] || "text-muted-foreground"} hover:bg-accent/40 hover:text-foreground`
                                }
                              `}
                            >
                              <span className={`mobile-app-icon mobile-app-icon-${mobileIconTone[item.path] || "slate"}`}><item.icon size={20} strokeWidth={active ? 2.5 : 2} /></span>
                              <span
                                className={`text-[10px] font-semibold leading-tight text-center ${
                                  active ? "text-primary" : "text-muted-foreground"
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* FAB - Ações rápidas */}
      {showFab && (
        <div
          className="fixed inset-0 z-[28] bg-background/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowFab(false)}
        />
      )}
      {/* Ações rápidas são de operação — não fazem sentido no painel do dono.
          Também somem nas telas de formulário: ali o botão flutuante fica por
          cima dos campos e do botão de avançar, e oferecer "novo cliente" a
          quem já está cadastrando um cliente não ajuda em nada. */}
      <div
        className={`fixed right-4 z-30 flex-col items-end gap-2.5 ${isPlatformMode || emFormulario ? "hidden" : "flex"}`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {showFab && fabActions.map((a, i) => (
          <button
            key={a.label}
            onClick={() => { a.onClick(); setShowFab(false); }}
            style={{ animationDelay: `${i * 40}ms` }}
            className="animate-slide-up flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-card border border-border/40 shadow-xl text-foreground text-[13px] font-semibold hover:scale-105 transition-transform"
          >
            <a.icon size={16} className="text-primary" />
            {a.label}
          </button>
        ))}
        <button
          onClick={() => setShowFab(!showFab)}
          aria-label="Ações rápidas"
          className={`w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 flex items-center justify-center transition-transform active:scale-90 ${showFab ? "rotate-45" : ""}`}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom nav */}
      <nav
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black/75 backdrop-blur-2xl shadow-[0_-16px_40px_-28px_hsl(0_0%_0%/.9)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch justify-around px-1.5 pt-1 pb-1">
          {visibleTabs.map((tab) => {
            const active =
              tab.path === "__more__"
                ? showMore || isInMoreSection
                : isActive(tab.path);

            return (
              <button
                key={tab.label}
                onClick={() => {
                  if (tab.path === "__more__") {
                    setShowMore(!showMore);
                  } else {
                    navigate(tab.path);
                    setShowMore(false);
                  }
                }}
                className={`
                  relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] rounded-xl
                  transition-all duration-200 active:scale-95
                  ${active ? "text-primary" : mobileIconColor[tab.path] || "text-muted-foreground"}
                `}
              >
                {/* Indicador ativo */}
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)] animate-scale-in" />
                )}

                <div
                  className={`
                    p-1 rounded-xl transition-all duration-200
                    ${active ? "scale-105" : ""}
                  `}
                >
                  <span className={`mobile-app-icon mobile-app-icon-${mobileIconTone[tab.path] || "slate"}`}><tab.icon size={20} strokeWidth={active ? 2.5 : 2} /></span>
                </div>
                <span
                  className={`text-[10px] font-semibold leading-none ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

    </>
  );
};

export default MobileBottomNav;
