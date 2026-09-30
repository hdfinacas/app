import {
  Settings, Building, Percent, MessageSquare, Webhook, Bell, Save, Plus, Trash2, Check, AlertTriangle, Palette, Upload, Image, Key, CreditCard, Bot, Clock, Shield, Zap, ToggleLeft, Send, Volume2, Sun, Moon, Monitor, Eye, LayoutDashboard, Users, Receipt, Info, Copy, ExternalLink, FileText, RotateCcw, Sparkles, Package,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  CONTRACT_PLACEHOLDERS, CONTRACT_CONDITIONS, DEFAULT_CONTRACT_TEMPLATE,
  CONTRACT_TEMPLATE_PRESETS, renderContractTemplate, variaveisDesconhecidas,
} from "@/utils/contractTemplate";
import { contratoDeExemplo } from "@/utils/contratoExemplo";
import type { ModuleKey } from "@/contexts/WhiteLabelContext";
import InstallAppCard from "@/components/InstallAppCard";
import { COLOR_PRESETS } from "../constants";
import type { SectionProps } from "../types";

const ContratoSection = ({ ctx }: SectionProps) => {
  const {
    form, setForm, inputCls, settings, templates,
    newTemplate, setNewTemplate, onAddTemplate, onDeleteTemplate, onAddPresetTemplate,
    logoInputRef, faviconInputRef, portalLogoInputRef,
    onUploadLogo, onUploadFavicon, onUploadPortalLogo,
    uploadingLogo, uploadingFavicon, uploadingPortalLogo,
    notify,
  } = ctx;

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const contractFileRef = useRef<HTMLInputElement>(null);
  const [verPrevia, setVerPrevia] = useState(true);

  const texto = form.custom_contract_template?.trim() ? form.custom_contract_template : DEFAULT_CONTRACT_TEMPLATE;
  const desconhecidas = useMemo(() => variaveisDesconhecidas(form.custom_contract_template || ""), [form.custom_contract_template]);
  const previa = useMemo(() => {
    try {
      return renderContractTemplate(
        texto,
        contratoDeExemplo({
          nome: form.company_name, cnpj: form.company_cnpj,
          endereco: form.company_address, telefone: form.company_phone,
        }),
      );
    } catch {
      return "Não foi possível montar a prévia com este texto.";
    }
  }, [texto, form.company_name, form.company_cnpj, form.company_address, form.company_phone]);

  /** Insere a variável onde o cursor está, em vez de só copiar. */
  const inserirNoCursor = (trecho: string) => {
    const area = areaRef.current;
    const atual = form.custom_contract_template || "";
    if (!area) {
      setForm({ ...form, custom_contract_template: atual + trecho });
      return;
    }
    const ini = area.selectionStart ?? atual.length;
    const fim = area.selectionEnd ?? atual.length;
    const novo = atual.slice(0, ini) + trecho + atual.slice(fim);
    setForm({ ...form, custom_contract_template: novo });
    requestAnimationFrame(() => {
      area.focus();
      const pos = ini + trecho.length;
      area.setSelectionRange(pos, pos);
    });
  };

  return (
    <>
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center"><FileText size={16} className="text-primary" /></div>
              <div>
                <h2 className="font-semibold text-foreground">Modelo de Contrato Personalizado</h2>
                <p className="text-xs text-muted-foreground">Cole seu próprio contrato. Ao fechar um empréstimo, os campos são preenchidos automaticamente.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/90">
              <p className="font-semibold mb-1.5 flex items-center gap-1.5"><Info size={12} /> Como funciona</p>
              <p>Use as variáveis abaixo entre <code className="bg-muted px-1 rounded">{"{{ }}"}</code> no texto. Quando o contrato for gerado, elas serão trocadas pelos dados reais do cliente e do empréstimo.</p>
              <p className="mt-1.5">Para repetir cada parcela, envolva uma linha em <code className="bg-muted px-1 rounded">{"{{#parcelas}}...{{/parcelas}}"}</code> usando <code className="bg-muted px-1 rounded">{"{{numero}}"}</code>, <code className="bg-muted px-1 rounded">{"{{vencimento}}"}</code> e <code className="bg-muted px-1 rounded">{"{{valor}}"}</code>.</p>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-semibold text-foreground">Modelos prontos</p><p className="text-[11px] text-muted-foreground">Escolha um ponto de partida e personalize se quiser.</p></div>
                <button type="button" onClick={() => contractFileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                  <Upload size={13} /> Importar TXT ou Markdown
                </button>
                <input ref={contractFileRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1_000_000) { notify("O arquivo deve ter no máximo 1 MB"); return; }
                  const content = await file.text();
                  setForm({ ...form, custom_contract_template: content });
                  notify("Modelo importado. Revise as variáveis e salve as configurações.");
                  event.target.value = "";
                }} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {CONTRACT_TEMPLATE_PRESETS.map((preset) => {
                  const active = form.custom_contract_template === preset.content;
                  return <button key={preset.id} type="button" onClick={() => setForm({ ...form, custom_contract_template: preset.content })}
                    className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
                    <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-foreground">{preset.name}</p>{active && <Check size={13} className="shrink-0 text-primary" />}</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{preset.description}</p>
                  </button>;
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Variáveis disponíveis (clique para inserir onde o cursor está)</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_PLACEHOLDERS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => inserirNoCursor(`{{${p.key}}}`)}
                    title={p.desc}
                    className="px-2 py-1 rounded-md bg-muted/40 hover:bg-primary/15 text-[11px] font-mono text-foreground border border-border transition-colors"
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Trechos que só aparecem quando o dado existe
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_CONDITIONS.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => inserirNoCursor(`{{#${c.key}}}\n\n{{/${c.key}}}`)}
                    title={c.desc}
                    className="px-2 py-1 rounded-md bg-muted/40 hover:bg-primary/15 text-[11px] font-mono text-foreground border border-border transition-colors"
                  >
                    {`{{#${c.key}}}`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                A cláusula de avalista, por exemplo, só faz sentido para quem tem avalista. Dentro de{" "}
                <code className="bg-muted px-1 rounded">{"{{#se_avalista}}…{{/se_avalista}}"}</code> o trecho some
                por completo nos contratos sem avalista, em vez de imprimir campos em branco.
              </p>
            </div>

            {desconhecidas.length > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Variáveis que o sistema não conhece
                </p>
                <p className="text-muted-foreground mt-1">
                  Estas vão sair no contrato do jeito que estão escritas, na cara do cliente:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {desconhecidas.map(v => (
                    <code key={v} className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono text-[11px]">
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Texto do contrato</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, custom_contract_template: DEFAULT_CONTRACT_TEMPLATE })}
                    className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-accent/30"
                  >
                    <RotateCcw size={11} /> Carregar modelo padrão
                  </button>
                  {form.custom_contract_template && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, custom_contract_template: "" })}
                      className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={11} /> Limpar (usar layout do sistema)
                    </button>
                  )}
                </div>
              </div>
              <textarea
                ref={areaRef}
                value={form.custom_contract_template}
                onChange={(e) => setForm({ ...form, custom_contract_template: e.target.value })}
                rows={20}
                placeholder="Cole aqui o texto do seu contrato. Ex: Contrato firmado entre {{empresa_nome}} e {{cliente_nome}} no valor de {{capital}}..."
                className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground font-mono leading-relaxed input-enhanced"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {form.custom_contract_template?.trim()
                  ? "✓ Modelo personalizado ativo — será usado em todos os novos contratos."
                  : "Sem modelo personalizado — o sistema usará o layout padrão."}
              </p>
            </div>

            {/* Prévia: o assinante escreve o contrato uma vez e precisa ver como
                ele chega ao cliente ANTES de fechar um empréstimo de verdade. */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Prévia com um cliente de exemplo
                </label>
                <button
                  type="button"
                  onClick={() => setVerPrevia(v => !v)}
                  className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-accent/30"
                >
                  <Eye size={11} /> {verPrevia ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {verPrevia && (
                <>
                  <div className="rounded-xl border border-border bg-background/60 p-4 max-h-96 overflow-auto">
                    <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground">
                      {previa}
                    </pre>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Dados inventados, só para conferência: Maria Exemplo, R$ 5.000 em 6x, com
                    avalista e desconto de antecipação — assim dá para ver também as cláusulas que
                    só aparecem em alguns contratos.
                    {!form.custom_contract_template?.trim() && " Como não há modelo próprio, esta é a prévia do modelo padrão do sistema."}
                  </p>
                </>
              )}
            </div>
          </div>
    </>
  );
};

export default ContratoSection;
