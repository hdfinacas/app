import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export type CredinhoPose = "welcome" | "organize" | "results" | "thinking" | "chat" | "loading" | "story" | "final";
const brandSymbol = "/brand/dh-financeira-symbol.png";

/** Each illustration is a separately generated composition, rendered at its natural ratio. */
export function Credinho({ pose = "welcome", className = "", priority = false, label }: {
  pose?: CredinhoPose; className?: string; priority?: boolean; label?: string;
}) {
  return <div className={`credinho ${className}`} data-pose={pose} style={{ aspectRatio: "1" }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={brandSymbol} alt="" width={512} height={512}
      loading={priority ? "eager" : "lazy"}
      decoding="async" draggable={false} />
  </div>;
}

export function CredinhoAvatar({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <img src={brandSymbol} alt="Assistente da DH Financeira" width={size} height={size}
    className={`credinho-avatar ${className}`} style={{ width: size, height: size }} loading="lazy" decoding="async" />;
}

/** The wide scene has its own composition; narrow screens use a separately drawn portrait. */
export function CredinhoBannerArt({ scene, className = "", priority = false }: { scene?: string; className?: string; priority?: boolean }) {
  const assets: Record<string, string> = {
    hoje: "/brand/dh-banner-gestao.png",
    clientes: "/brand/dh-banner-atendimento.png",
    cobrancas: "/brand/dh-banner-atendimento.png",
    investidores: "/brand/dh-banner-atendimento.png",
    admin: "/brand/dh-banner-analise.png",
    analises: "/brand/dh-banner-analise.png",
    carteira: "/brand/dh-banner-analise.png",
    relatorios: "/brand/dh-banner-analise.png",
    metas: "/brand/dh-banner-analise.png",
    "agente-ia": "/brand/dh-banner-analise.png",
  };
  const image = assets[scene || ""] || "/brand/dh-banner-gestao.png";
  return <picture className={`credinho-banner-art ${className}`} data-wide="true" data-scene={scene || "default"} aria-hidden="true">
    <img src={image} alt=""
      width={2048} height={512}
      loading={priority ? "eager" : "lazy"} decoding="async" />
  </picture>;
}

export function CredinhoLoader({ label = "Preparando seu próximo passo", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return <div role="status" aria-live="polite" aria-label={label} className={`flex flex-col items-center justify-center gap-3 bg-[#042A40] px-6 text-center text-white ${fullScreen ? "min-h-dvh" : "min-h-[360px]"}`}>
    <img src="/brand/dh-financeira-symbol.png" alt="" className="mb-2 h-16 w-16 rounded-2xl" />
    <span className="text-xs font-semibold tracking-[0.16em] text-[#00B6EF]">DH FINANCEIRA</span>
    <p className="text-lg font-semibold">{label}</p>
    <span className="text-xs text-white/60">Carregando suas informações.</span>
    <span className="mt-2 h-1 w-36 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-1/2 animate-pulse rounded-full bg-[#00B6EF]" /></span>
  </div>;
}

const themes: Record<string, { pose: CredinhoPose; title: string; text: string; to: string; action: string }> = {
  hoje: { pose: "organize", title: "Um passo de cada vez. Tudo no lugar.", text: "Seus compromissos e prioridades para seguir o dia com clareza.", to: "/cobrancas", action: "Ver cobranças" },
  admin: { pose: "results", title: "Uma plataforma. Muitas conquistas.", text: "Acompanhe sua plataforma e mantenha cada detalhe por perto.", to: "/configuracoes", action: "Configurar plataforma" },
  investidores: { pose: "results", title: "Parcerias que fazem crescer.", text: "Organize seus aportes e acompanhe cada parceria com clareza.", to: "/relatorios", action: "Ver relatórios" },
  metas: { pose: "results", title: "Cada passo conta para sua conquista.", text: "Defina suas metas e acompanhe sua evolução.", to: "/relatorios", action: "Ver resultados" },
  analises: { pose: "thinking", title: "Entenda hoje. Planeje o amanhã.", text: "Uma visão dos seus números para apoiar suas próximas decisões.", to: "/relatorios", action: "Ver relatórios" },
  clientes: { pose: "welcome", title: "Cada cliente, uma nova conquista.", text: "Relacionamentos bem cuidados começam com informações organizadas.", to: "/clientes/novo", action: "Cadastrar cliente" },
  cobrancas: { pose: "organize", title: "Organiza hoje. Conquista amanhã.", text: "Acompanhe os vencimentos e encontre o próximo passo da sua cobrança.", to: "/hoje", action: "Ver meu dia" },
  carteira: { pose: "results", title: "Uma visão clara para ir mais longe.", text: "Acompanhe sua carteira e decida com os números à mão.", to: "/relatorios", action: "Ver relatórios" },
  relatorios: { pose: "results", title: "Seus números contam uma história.", text: "Encontre os resultados que ajudam a planejar o próximo movimento.", to: "/carteira", action: "Ver carteira" },
  "agente-ia": { pose: "thinking", title: "Mais organização para sua rotina.", text: "Configure seu assistente e acompanhe suas automações em um só lugar.", to: "/central-bot", action: "Abrir central" },
};

export function CredinhoBanner() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[1];
  const theme = themes[section];
  // Keep data-entry screens and deep detail routes focused on the task.
  if (!theme || pathname.split("/").filter(Boolean).length > 1) return null;
  return <aside className="credinho-banner credinho-context-banner mb-6">
    <CredinhoBannerArt scene={section} />
    <div className="credinho-banner-copy relative z-10 py-6 pl-5 sm:pl-8">
      <span className="credinho-kicker">COM VOCÊ, EM CADA PASSO</span>
      <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{theme.title}</h2>
      <p className="mt-2 max-w-md text-sm text-white/60">{theme.text}</p>
      <Link to={theme.to} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#00B6EF] hover:underline">{theme.action}<ArrowUpRight size={15} /></Link>
    </div>
  </aside>;
}
