import { Credinho, type CredinhoPose } from "@/components/brand/Credinho";
import { Users, CalendarClock, MessageSquareText, LineChart, Wallet, ShieldCheck } from "lucide-react";
import defaultLogo from "@/assets/credmais-mark.svg";

const features = [
  {
    icon: Users,
    title: "Clientes e contratos",
    text: "Cadastro guiado, histórico completo, score de crédito e renegociação sem sair da ficha do cliente.",
  },
  {
    icon: CalendarClock,
    title: "Parcelas e atrasos",
    text: "Os juros de atraso são aplicados sozinhos, dia após dia, com o detalhamento de tudo o que foi cobrado.",
  },
  {
    icon: MessageSquareText,
    title: "Cobrança no WhatsApp",
    text: "Mensagem curta, PIX e link do portal saindo na hora certa, sem você digitar nada.",
  },
  {
    icon: LineChart,
    title: "Painel e relatórios",
    text: "Lucro realizado, carteira ativa e inadimplência sempre à mão para decidir onde emprestar mais.",
  },
  {
    icon: Wallet,
    title: "Investidores",
    text: "Aportes, rateio de lucro e portal próprio com extrato em PDF para cada investidor da sua operação.",
  },
  {
    icon: ShieldCheck,
    title: "Portal do cliente",
    text: "Segunda via, comprovante e negociação no autoatendimento — você para de responder no manual.",
  },
];

const LandingFeatures = () => {
  return (
    <section id="features" className="py-20 lg:py-28 relative">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary">A plataforma</span>
          <h2 className="font-editorial text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05] text-foreground mt-4">
            Tudo o que hoje toma o seu dia, feito aqui em segundos.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-3xl overflow-hidden" data-anim-group>
          {features.map(({ icon: Icon, title, text }, i) => (
            <div key={title} data-anim="up" className="group bg-card p-7 sm:p-8 transition-colors hover:bg-secondary/60">
              <div className="flex items-end justify-between"><Icon size={22} className="text-primary" /><Credinho pose={(["welcome", "organize", "thinking", "results", "results", "welcome"] as CredinhoPose[])[i]} className="w-[50px]" /></div>
              <h3 className="font-editorial text-2xl text-foreground mt-6">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center gap-6 rounded-3xl border border-border obsidian-card p-7 sm:p-9" data-anim="scale">
          <img
            src={defaultLogo}
            alt="Símbolo CredMais C+"
            width={160}
            height={160}
            loading="lazy"
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover flex-shrink-0 ring-1 ring-primary/35"
          />
          <div className="text-center sm:text-left">
            <p className="font-editorial text-2xl sm:text-3xl text-foreground">
              CredMais no controle. Você cobra antes.
            </p>
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              Alertas de vencimento, leitura da carteira e agente de IA trabalhando o dia inteiro
              para que nenhuma parcela vire prejuízo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
