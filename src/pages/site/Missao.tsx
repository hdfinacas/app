import { Link } from "react-router-dom";
import { SitePage, Card } from "@/components/site/SiteLayout";

const VALUES = [
  ["Receber em dia é respeito", "Cobrança clara, na hora certa, com valor exato."],
  ["Nada de trabalho manual", "Se o sistema pode calcular, lembrar ou enviar, ele faz."],
  ["Transparência com o cliente", "Portal aberto por CPF: parcelas, juros, PIX e histórico."],
  ["Decisão com número na mão", "Lucro, risco e inadimplência sempre atualizados."],
];

export default function Missao() {
  return (
    <SitePage
      eyebrow="Missão"
      title="Zero atraso invisível"
      intro="Nenhum atraso passa despercebido e nenhum lucro fica escondido em planilha."
    >
      <Card>
        <p className="max-w-3xl text-base leading-relaxed text-white/70 md:text-lg">
          Emprestar dinheiro já exige coragem. Cobrar não deveria exigir tempo, memória e desgaste. Construímos o
          CredMais para que cada real emprestado tenha o caminho de volta desenhado: data, valor, juros, mensagem e
          comprovante.
        </p>
      </Card>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {VALUES.map(([t, d], i) => (
          <Card key={t}>
            <div className="font-mono text-xs text-[#F5BD59]">0{i + 1}</div>
            <div className="font-display mt-4 text-lg font-medium">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
          </Card>
        ))}
      </div>

      <Link
        to="/planos"
        className="mt-12 inline-flex rounded-xl bg-[#A46A19] px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-[#F5BD59]"
      >
        Ver planos e começar
      </Link>
    </SitePage>
  );
}
