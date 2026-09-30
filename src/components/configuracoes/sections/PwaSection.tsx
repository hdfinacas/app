import {
  Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle, Palette, Upload, Image, Key, CreditCard, Bot, Clock, Shield, Zap, ToggleLeft, Send, Volume2, Sun, Moon, Monitor, Eye, LayoutDashboard, Users, Receipt, Info, Copy, ExternalLink, FileText, RotateCcw, Sparkles, Package,
} from "lucide-react";
import { CONTRACT_PLACEHOLDERS, DEFAULT_CONTRACT_TEMPLATE } from "@/utils/contractTemplate";
import type { ModuleKey } from "@/contexts/WhiteLabelContext";
import InstallAppCard from "@/components/InstallAppCard";
import { COLOR_PRESETS } from "../constants";
import type { SectionProps } from "../types";

const PwaSection = ({ ctx }: SectionProps) => {
  const {
    form, setForm, inputCls, settings, templates,
    newTemplate, setNewTemplate, onAddTemplate, onDeleteTemplate, onAddPresetTemplate,
    logoInputRef, faviconInputRef, portalLogoInputRef,
    onUploadLogo, onUploadFavicon, onUploadPortalLogo,
    uploadingLogo, uploadingFavicon, uploadingPortalLogo,
    notify,
  } = ctx;

  return (
    <>
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Zap size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Transformar em Aplicativo Mobile</h2>
                <p className="text-xs text-muted-foreground">Instale o sistema no Android ou iPhone sem precisar de loja</p>
              </div>
            </div>

            {/* Botão real de instalação: nativo no Android, guiado no iPhone */}
            <InstallAppCard />

            <div className="p-4 rounded-2xl border border-border/30 bg-accent/5 space-y-2">
              <p className="text-xs font-semibold text-foreground">O que muda depois de instalar</p>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Abre em tela cheia, sem a barra de endereço do navegador.</li>
                <li>Ícone próprio junto dos outros aplicativos do celular.</li>
                <li>Abre as telas e os dados sincronizados recentemente mesmo sem internet.</li>
                <li>Simulador e rascunho de novo empréstimo continuam disponíveis offline.</li>
                <li>Pagamentos e outras ações financeiras aguardam conexão para evitar duplicidade.</li>
                <li>Atalhos rápidos ao segurar o ícone: Hoje, Novo cliente e Cobranças.</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3">
              <img src="/apple-touch-icon.png" alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O ícone do aplicativo instalado vem do arquivo padrão do sistema. Para usar a sua
                própria marca, envie o favicon na aba <strong className="text-foreground">Marca, Cores &amp; Tema</strong> —
                ele passa a valer nas próximas instalações.
              </p>
            </div>
          </div>
    </>
  );
};

export default PwaSection;
