import { Palette, Image, Upload, Check } from "lucide-react";
import type { SettingsCtx } from "./types";



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

          <div className="space-y-4 rounded-2xl border border-border bg-background/50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="h-4 w-4 text-primary" /> Paleta da DH Financeira
            </div>
            <div className="flex flex-wrap gap-3" aria-label="Preto, branco e azul">
              {[{ name: "Preto", color: "#050609" }, { name: "Branco", color: "#fafafa" }, { name: "Azul", color: "#2563eb" }].map((swatch) => (
                <span key={swatch.name} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-foreground">
                  <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: swatch.color }} />
                  {swatch.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Tema escuro fixo com superfícies pretas, texto branco e ações azuis.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AparenciaConfig;
