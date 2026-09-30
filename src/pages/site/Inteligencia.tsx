import { SitePage, Card } from "@/components/site/SiteLayout";

const PILLARS = [
  { t: "Régua de cobrança automática", d: "O sistema sabe o que vence hoje e o que já venceu. Cada cliente recebe a mensagem certa, no dia certo, com PIX e link do portal." },
  { t: "Juros de atraso no automático", d: "4% ao dia sobre a parcela, acumulando sozinho. Nada de calcular multa na mão." },
  { t: "Agente de IA 24 horas", d: "Conversa, negocia, registra o pagamento e chama você só quando precisa de decisão humana." },
  { t: "Risco da carteira", d: "Faixas de atraso, score do cliente e prioridade de cobrança do dia." },
];

const FLOW = [
  ["01", "Contrato criado", "Parcelas com juros, frequência e datas em segundos."],
  ["02", "Lembrete enviado", "Aviso antes do vencimento, com PIX pronto."],
  ["03", "Atraso detectado", "Juros diários aplicados e cobrança disparada."],
  ["04", "Pagamento baixado", "Recebimento registrado e lucro atualizado."],
];

export default function Inteligencia() {
  return (
    <SitePage
      eyebrow="Cobrança"
      title="Cobrar sem precisar lembrar"
      intro="O CredMais transforma sua carteira em um sistema que calcula, lembra, cobra e registra cada centavo."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PILLARS.map((p) => (
          <Card key={p.t}>
            <div className="font-display text-lg font-medium">{p.t}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{p.d}</p>
          </Card>
        ))}
      </div>

      <h2 className="font-display mt-16 text-2xl font-semibold tracking-tight md:text-3xl">Na prática</h2>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW.map(([n, t, d]) => (
          <Card key={n}>
            <div className="font-mono text-sm text-[#F5BD59]">{n}</div>
            <div className="mt-4 text-sm font-medium uppercase tracking-wide">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
          </Card>
        ))}
      </div>
    </SitePage>
  );
}
