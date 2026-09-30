import { Palette, Image, Upload, Check, Monitor, Sun, Moon } from "lucide-react";
import type { SettingsCtx } from "./types";

const COLOR_PRESETS = [
  { label: "Azul Steel", primary: "#4a86c8", accent: "#6ba3d6", emoji: "🔷" },
  { label: "Azul Royal", primary: "#2563eb", accent: "#3b82f6", emoji: "💎" },
  { label: "Esmeralda", primary: "#059669", accent: "#10b981", emoji: "💚" },
  { label: "Roxo", primary: "#7c3aed", accent: "#8b5cf6", emoji: "💜" },
  { label: "Âmbar", primary: "#d97706", accent: "#f59e0b", emoji: "🟡" },
  { label: "Vermelho", primary: "#dc2626", accent: "#ef4444", emoji: "❤️" },
];

const AparenciaConfig = ({ ctx }: { ctx: SettingsCtx }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-primary" /> Identidade Visual
          </h2>
          <p className="text-sm text-muted-foreground">Personalize as cores e o logotipo da sua plataforma.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 p-6 rounded-2xl bg-muted/30 border border-border/50">
            <label className="text-sm font-medium flex items-center gap-2">
              <Image className="w-4 h-4" /> Logotipo Principal
            </label>
            <div className="flex flex-col items-center gap-4">
              <div className="relative group w-full aspect-[3/1] rounded-xl border border-dashed border-border/50 flex items-center justify-center bg-background/50 overflow-hidden">
                {ctx.form.company_logo_url ? (
                  <img src={ctx.form.company_logo_url} alt="Logo" className="h-12 object-contain transition-transform group-hover:scale-105" />
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhuma imagem</span>
                )}
                <div 
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={() => ctx.logoInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5 text-white animate-bounce" />
                </div>
              </div>
              <input type="file" ref={ctx.logoInputRef} onChange={ctx.onUploadLogo} accept="image/*" className="hidden" />
              <button 
                onClick={() => ctx.logoInputRef.current?.click()}
                disabled={ctx.uploadingLogo}
                className="w-full py-2 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {ctx.uploadingLogo ? "Enviando..." : "Alterar Logotipo"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Paleta de Cores</label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => ctx.setForm({ ...ctx.form, primary_color: p.primary, accent_color: p.accent })}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      ctx.form.primary_color === p.primary ? "border-primary bg-primary/10 shadow-sm" : "border-border/50 bg-background/50"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full shadow-inner" style={{ background: p.primary }} />
                    <span className="text-[10px] font-medium truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Modo do Tema</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "light", label: "Claro", icon: Sun },
                  { id: "dark", label: "Escuro", icon: Moon },
                  { id: "system", label: "Sistema", icon: Monitor },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => ctx.setForm({ ...ctx.form, theme_mode: t.id as any })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      ctx.form.theme_mode === t.id ? "border-primary bg-primary/10" : "border-border/50 bg-background/50"
                    }`}
                  >
                    <t.icon className={`w-4 h-4 ${ctx.form.theme_mode === t.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-[10px] font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AparenciaConfig;
