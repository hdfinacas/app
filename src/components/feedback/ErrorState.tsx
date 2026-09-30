import { Credinho } from "@/components/brand/Credinho";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { friendlyError } from "@/lib/friendlyError";

type Props = {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
};

/**
 * Estado de erro amigável: nunca mostra stack trace nem mensagem crua do banco.
 * Sempre oferece um caminho de saída (tentar de novo).
 */
export const ErrorState = ({ error, title, description, onRetry, retryLabel = "Tentar novamente", compact = false }: Props) => {
  const friendly = friendlyError(error);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={`relative flex flex-col items-center justify-center overflow-hidden text-center rounded-2xl border border-destructive/20 bg-destructive/5 ${compact ? "py-8 px-4" : "py-14 px-6"}`}
    >
      {!compact && <Credinho pose="thinking" className="credinho-empty" />}
      <div className={`${compact ? "w-12 h-12" : "w-16 h-16"} rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4`}>
        <Icon className={`${compact ? "w-5 h-5" : "w-7 h-7"} text-destructive`} strokeWidth={1.5} />
      </div>
      <h3 className={`${compact ? "text-sm" : "text-base"} font-bold text-foreground`}>
        {title ?? (offline ? "Sem conexão" : friendly.title)}
      </h3>
      <p className={`${compact ? "text-[11px]" : "text-xs"} text-muted-foreground mt-1.5 max-w-sm`}>
        {description ?? (offline ? "Verifique sua internet e tente de novo." : friendly.description)}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent transition-colors"
        >
          <RefreshCw size={14} /> {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
