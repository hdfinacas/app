import { AlertTriangle } from "lucide-react";
import { renderTemplate } from "@/lib/messageTemplate";

/**
 * Avisa, na hora da edição, que a mensagem tem uma variável que o sistema não
 * conhece. Sem isso o erro só aparecia depois — no WhatsApp do cliente, com o
 * marcador literal no meio da frase.
 */
const VariaveisNaoReconhecidas = ({ texto }: { texto: string }) => {
  if (!texto?.trim()) return null;

  const { desconhecidas } = renderTemplate(texto, {});
  if (!desconhecidas.length) return null;

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-warning/30 bg-warning/5">
      <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {desconhecidas.length === 1 ? "Esta variável não existe" : "Estas variáveis não existem"}:{" "}
        {desconhecidas.map((v, i) => (
          <span key={v}>
            {i > 0 && ", "}
            <code className="font-mono text-warning">{`{${v}}`}</code>
          </span>
        ))}
        . O cliente vai receber esse texto do jeito que está. Use uma das opções acima.
      </p>
    </div>
  );
};

export default VariaveisNaoReconhecidas;
