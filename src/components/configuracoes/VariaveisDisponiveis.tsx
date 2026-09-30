import { Info } from "lucide-react";
import { VARIAVEIS_SUPORTADAS } from "@/lib/messageTemplate";

/**
 * Catálogo de variáveis das mensagens, gerado a partir da MESMA lista que o
 * renderizador usa. Antes cada aba anunciava um conjunto diferente — Templates
 * dizia `[Nome] [Valor] [Dias] [Portal]`, o Bot dizia `{nome} {empresa} {valor}
 * {data}` e a Mensagem Padrão dizia `[Nome da Empresa]` — e vários deles não
 * eram substituídos por ninguém. Com a lista vindo do código, a tela não tem
 * como prometer o que não existe.
 */
const VariaveisDisponiveis = ({ onCopiar }: { onCopiar?: (texto: string) => void }) => (
  <div className="p-3 rounded-xl border border-border/40 bg-accent/10 space-y-2">
    <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
      <Info size={12} className="text-primary" /> Variáveis que você pode usar
    </p>
    <div className="flex flex-wrap gap-1.5">
      {VARIAVEIS_SUPORTADAS.map((v) => (
        <button
          key={v.chave}
          type="button"
          title={v.descricao}
          onClick={() => onCopiar?.(`{${v.chave}}`)}
          className="px-2 py-1 rounded-md bg-muted/40 hover:bg-primary/15 text-[11px] font-mono text-foreground border border-border transition-colors"
        >
          {`{${v.chave}}`}
        </button>
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground leading-relaxed">
      Funciona com chaves <code className="font-mono">{"{nome}"}</code> ou colchetes{" "}
      <code className="font-mono">[Nome]</code> — os dois valem, com ou sem acento e
      em qualquer caixa. Se você escrever uma variável que não existe, ela aparece
      avisada aqui embaixo antes de a mensagem ir para o cliente.
    </p>
  </div>
);

export default VariaveisDisponiveis;
