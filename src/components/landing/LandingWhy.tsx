import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const rows = [
  {
    before: "Você anota tudo na planilha e no caderno",
    after: "Contrato, parcelas e histórico organizados em um só lugar",
  },
  {
    before: "Precisa lembrar de cobrar cliente por cliente",
    after: "A régua dispara a cobrança no WhatsApp por você",
  },
  {
    before: "Faz conta de atraso na calculadora",
    after: "O sistema calcula o atraso sozinho, todo dia",
  },
  {
    before: "Recebe mensagem a qualquer hora pedindo saldo",
    after: "O cliente consulta e paga sozinho no portal",
  },
  {
    before: "No fim do mês não sabe quanto lucrou de verdade",
    after: "Lucro, carteira e inadimplência prontos no painel",
  },
];

const LandingWhy = () => {
  return (
    <section id="why" className="py-20 lg:py-28 relative">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary">Por que assinar</span>
          <h2 className="font-editorial text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05] text-foreground mt-4">
            A diferença entre correr atrás e receber em dia.
          </h2>
        </div>

        <div className="mt-12 rounded-3xl border border-border overflow-hidden" data-anim-group>
          {rows.map(({ before, after }) => (
            <div
              key={before}
              data-anim="up"
              className="grid grid-cols-1 sm:grid-cols-2 border-b border-border last:border-b-0"
            >
              <p className="p-6 sm:p-7 text-sm text-muted-foreground/70 line-through decoration-muted-foreground/30 bg-secondary/30">
                {before}
              </p>
              <p className="p-6 sm:p-7 text-sm text-foreground border-t sm:border-t-0 sm:border-l border-border bg-card">
                {after}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-5 rounded-3xl obsidian-card border border-border p-7 sm:p-9" data-anim="scale">
          <p className="font-editorial text-2xl sm:text-3xl text-foreground text-center sm:text-left max-w-xl">
            Uma parcela recuperada já paga a sua mensalidade.
          </p>
          <Link
            to="/checkout"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold whitespace-nowrap"
          >
            Começar a usar
            <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default LandingWhy;
