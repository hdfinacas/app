import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Texto exibido enquanto a ação roda. Se ausente, mantém o conteúdo original. */
  loadingText?: string;
  icon?: ReactNode;
  variant?: "primary" | "ghost" | "outline" | "destructive";
}

const VARIANTS: Record<NonNullable<Props["variant"]>, string> = {
  primary: "text-primary-foreground hover:shadow-lg hover:shadow-primary/20",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
  outline: "border border-border text-foreground hover:bg-accent",
  destructive: "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25",
};

/**
 * Botão com spinner embutido e bloqueio automático durante a ação,
 * evitando cliques duplicados e telas "travadas" sem feedback.
 */
export const LoadingButton = ({
  loading = false,
  loadingText,
  icon,
  children,
  className,
  variant = "primary",
  disabled,
  style,
  ...rest
}: Props) => (
  <button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading}
    style={variant === "primary" ? { background: "var(--gradient-button)", ...style } : style}
    className={cn(
      "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
      "disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]",
      VARIANTS[variant],
      className,
    )}
  >
    {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
    <span>{loading ? loadingText ?? children : children}</span>
  </button>
);

export default LoadingButton;
