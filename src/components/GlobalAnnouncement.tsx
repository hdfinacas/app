import { useState } from "react";
import { Megaphone, X } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

/**
 * Faixa de comunicado escrita pelo dono do app em /admin → Plataforma.
 * Aparece para todos os assinantes; cada um pode dispensar (volta se o texto mudar).
 */
const DISMISS_KEY = "platform-announcement-dismissed";

const GlobalAnnouncement = () => {
  const { settings } = usePlatformSettings();
  const message = settings.global_announcement?.trim();

  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (!message || dismissed === message) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, message);
    } catch {}
    setDismissed(message);
  };

  return (
    <div
      role="status"
      className="mx-auto max-w-[1600px] px-4 pt-3 sm:px-5 md:px-6 lg:px-8"
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-2.5">
        <Megaphone size={15} className="text-primary shrink-0 mt-0.5" />
        <p className="flex-1 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dispensar comunicado"
          className="text-muted-foreground hover:text-foreground transition p-0.5 shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default GlobalAnnouncement;
