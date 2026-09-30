import { SitePage, Card } from "@/components/site/SiteLayout";

const MODULES = [
  ["Clientes e contratos", "Cadastro em etapas, documentos, histórico e score em uma ficha única."],
  ["Cobranças do dia", "Quem vence hoje, quem atrasou, valor com e sem juros, quitação parcial."],
  ["Portais externos", "Portal do cliente por CPF e portal do cobrador por token."],
  ["Carteira e investidores", "Aportes, rendimentos e extratos em PDF para cada investidor."],
  ["Lucros e relatórios", "Lucro realizado, projetado, gastos e inadimplência por período."],
  ["WhatsApp integrado", "Inbox, agente de IA e disparos dentro do app."],
];

const USES = [
  ["No celular", "App fluido no bolso, com cobrança em dois toques."],
  ["No computador", "Painel completo e relatórios prontos para imprimir."],
  ["Sem treinamento", "Fluxos guiados por etapas: qualquer pessoa usa no primeiro dia."],
];

export default function SobreCredmais() {
  return (
    <SitePage
      eyebrow="O app"
      title="Quem empresta merece controle"
      intro="Um só app para carteira, cobrança e lucro. Sem planilha, sem caderno, sem depender da memória."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES.map(([t, d]) => (
          <Card key={t}>
            <div className="font-display text-base font-medium">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
          </Card>
        ))}
      </div>

      <h2 className="font-display mt-16 text-2xl font-semibold tracking-tight md:text-3xl">Feito para o dia a dia</h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {USES.map(([t, d]) => (
          <Card key={t}>
            <div className="text-xs uppercase tracking-[0.2em] text-[#F5BD59]">{t}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{d}</p>
          </Card>
        ))}
      </div>
    </SitePage>
  );
}
