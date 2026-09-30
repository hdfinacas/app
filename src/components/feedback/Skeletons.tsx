import { cn } from "@/lib/utils";

const base = "skeleton-shimmer";

/** Bloco genérico de esqueleto. */
export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn(base, "h-4 w-full", className)} />
);

/** Lista vertical de linhas (tarefas, gastos, parcelas...). */
export const SkeletonList = ({ rows = 5, height = "h-16", className }: { rows?: number; height?: string; className?: string }) => (
  <div role="status" aria-label="Carregando conteúdo" className={cn("space-y-2", className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={cn(base, height)} style={{ animationDelay: `${i * 80}ms` }} />
    ))}
    <span className="sr-only">Carregando…</span>
  </div>
);

/** Grade de cards. */
export const SkeletonCards = ({
  count = 6,
  height = "h-40",
  className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
}: { count?: number; height?: string; className?: string }) => (
  <div role="status" aria-label="Carregando conteúdo" className={className}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={cn(base, height)} style={{ animationDelay: `${i * 60}ms` }} />
    ))}
    <span className="sr-only">Carregando…</span>
  </div>
);

/** Faixa de KPIs / estatísticas. */
export const SkeletonStats = ({ count = 3, className }: { count?: number; className?: string }) => (
  <div role="status" aria-label="Carregando indicadores" className={cn("grid gap-3", className ?? "grid-cols-2 sm:grid-cols-3")}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={cn(base, "h-24")} style={{ animationDelay: `${i * 60}ms` }} />
    ))}
    <span className="sr-only">Carregando…</span>
  </div>
);

/** Esqueleto de tabela com cabeçalho. */
export const SkeletonTable = ({ rows = 6, className }: { rows?: number; className?: string }) => (
  <div role="status" aria-label="Carregando tabela" className={cn("rounded-2xl border border-border bg-card p-4 space-y-3", className)}>
    <div className={cn(base, "h-8 w-1/3")} />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={cn(base, "h-10")} style={{ animationDelay: `${i * 60}ms` }} />
    ))}
    <span className="sr-only">Carregando…</span>
  </div>
);

/** Esqueleto de página inteira (hero + stats + lista). */
export const SkeletonPage = () => (
  <div className="space-y-6 animate-fade-in">
    <div className={cn(base, "h-24")} />
    <SkeletonStats />
    <SkeletonList rows={4} />
  </div>
);
