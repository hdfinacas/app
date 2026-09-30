import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
  label?: string;
};

/** Spinner acessível e consistente com o design system. */
export const Spinner = ({ size = 16, className, label }: Props) => (
  <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2", className)}>
    <Loader2 size={size} className="animate-spin" aria-hidden />
    {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Carregando…</span>}
  </span>
);

export default Spinner;
