import { useState } from "react";
import { Check, Download, Share, Plus, Smartphone, Apple, Globe } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Cartão de instalação do app na tela inicial.
 * Android/Chrome: botão que dispara o instalador nativo do navegador.
 * iOS/Safari: passo a passo guiado (a Apple não permite instalar por código).
 */
const InstallAppCard = () => {
  const { installed, canPrompt, isIOS, method, install } = usePwaInstall();
  const { config } = useWhiteLabel();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const appName = config.companyName || "CredMais App";
  const icon = config.faviconUrl || config.companyLogo || "/apple-touch-icon.png";

  if (installed) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success/5 p-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
          <Check className="text-success" size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">App instalado</p>
          <p className="text-xs text-muted-foreground">
            Você já está usando o {appName} como aplicativo.
          </p>
        </div>
      </div>
    );
  }

  const handleInstall = async () => {
    if (!canPrompt) {
      toast({
        title: isIOS ? "Instale pelo Safari" : "Instale pelo menu do navegador",
        description: isIOS
          ? "Toque em Compartilhar e depois em Adicionar à Tela de Início."
          : "Abra o menu do Chrome ou Edge e escolha Instalar aplicativo.",
      });
      return;
    }
    setBusy(true);
    const accepted = await install();
    setBusy(false);
    if (accepted) {
      toast({ title: "✓ App instalado!", description: "O ícone já está na sua tela inicial." });
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <img
          src={icon}
          alt=""
          className="w-12 h-12 rounded-xl object-cover bg-white/5 ring-1 ring-border/40 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">Instalar {appName}</p>
          <p className="text-xs text-muted-foreground">
            Abre em tela cheia, com ícone próprio e sem barra do navegador.
          </p>
        </div>
      </div>

      <button
        onClick={() => void handleInstall()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
      >
        {isIOS && method !== "prompt" ? <Share size={16} /> : <Download size={16} />}
        {busy ? "Instalando..." : canPrompt ? "Instalar agora" : isIOS ? "Instalar no iPhone ou iPad" : "Instalar aplicativo"}
      </button>

      {!canPrompt && isIOS && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Apple size={13} /> No iPhone ou iPad, pelo Safari:
          </p>
          <ol className="space-y-2">
            {[
              { icon: Share, text: "Toque no botão Compartilhar, na barra do Safari." },
              { icon: Plus, text: 'Role a lista e toque em "Adicionar à Tela de Início".' },
              { icon: Check, text: 'Confirme em "Adicionar", no canto superior direito.' },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="w-5 h-5 rounded-md bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-px">
                  <step.icon size={12} />
                </span>
                <span className="leading-relaxed">
                  <strong className="text-foreground font-semibold">{i + 1}.</strong> {step.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-1 border-t border-border/25">
            Precisa ser pelo <strong className="text-foreground">Safari</strong>. Chrome e Firefox no
            iPhone não conseguem instalar — é limitação da Apple, não do sistema.
          </p>
        </div>
      )}

      {!canPrompt && !isIOS && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Globe size={13} /> No Android ou computador, pelo Chrome ou Edge:
          </p>
          <ol className="space-y-2">
            {[
              { icon: Smartphone, text: "Abra o menu do navegador (⋮ no canto superior)." },
              { icon: Download, text: 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".' },
              { icon: Check, text: "Confirme e o ícone aparece junto dos seus apps." },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="w-5 h-5 rounded-md bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-px">
                  <step.icon size={12} />
                </span>
                <span className="leading-relaxed">
                  <strong className="text-foreground font-semibold">{i + 1}.</strong> {step.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-1 border-t border-border/25">
            O botão automático aparece assim que o navegador libera a instalação. Se não surgir,
            use o menu acima — o resultado é o mesmo.
          </p>
        </div>
      )}
    </div>
  );
};

export default InstallAppCard;
