import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, ShieldCheck, UsersRound } from "lucide-react";

const capabilities = [
  {
    icon: UsersRound,
    title: "Relacionamento organizado",
    text: "Acompanhe clientes, contratos e histórico em um só lugar.",
  },
  {
    icon: BarChart3,
    title: "Visão da carteira",
    text: "Consulte parcelas, recebimentos e resultados com mais clareza.",
  },
  {
    icon: ShieldCheck,
    title: "Acesso protegido",
    text: "Cada pessoa usa uma conta criada e liberada pelo administrador.",
  },
];

export default function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F5F7FA] text-[#042A40]">
      <header className="relative z-10 mx-auto flex h-[82px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="DH Financeira, página inicial">
          <img src="/brand/dh-financeira-horizontal.png" alt="DH Financeira" className="h-12 w-auto object-contain" />
        </Link>
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#006BCC] px-5 text-sm font-semibold text-white shadow-lg shadow-[#006BCC]/15 transition hover:bg-[#0059b3]"
        >
          Acessar o sistema <ArrowRight size={16} />
        </Link>
      </header>

      <section className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:pb-24 lg:pt-12">
        <div className="relative z-[1] max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#006BCC]/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-[#006BCC] shadow-sm">
            <BadgeCheck size={15} /> GESTÃO COM CLAREZA E CONFIANÇA
          </div>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-5xl lg:text-[3.65rem]">
            Mais clareza para cuidar de cada <span className="text-[#006BCC]">conquista.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#456477] sm:text-lg">
            A DH Financeira reúne clientes, contratos e recebimentos em uma experiência simples, segura e feita para acompanhar o seu trabalho.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#006BCC] px-7 text-sm font-semibold text-white shadow-xl shadow-[#006BCC]/20 transition hover:-translate-y-0.5 hover:bg-[#0059b3]">
              Entrar na plataforma <ArrowRight size={17} />
            </Link>
            <a href="#plataforma" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[#042A40]/15 bg-white px-7 text-sm font-semibold text-[#042A40] transition hover:border-[#00B6EF]">
              Conhecer a plataforma
            </a>
          </div>
          <p className="mt-5 text-xs leading-6 text-[#5b7483]">O acesso é disponibilizado pelo administrador da DH Financeira.</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-[#00B6EF]/15 blur-3xl" />
          <img
            src="/brand/dh-hero-consultation.png"
            alt="Atendimento da DH Financeira a uma cliente"
            className="relative aspect-[1.2/1] w-full rounded-[1.75rem] object-cover shadow-2xl shadow-[#042A40]/15 ring-1 ring-white"
            fetchPriority="high"
          />
          <div className="absolute -bottom-5 left-4 right-4 flex items-center gap-4 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-8 sm:right-auto sm:max-w-[340px] sm:p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D8E8F7] text-[#006BCC]"><BriefcaseBusiness size={22} /></span>
            <div><p className="text-sm font-semibold">Sua operação em ordem</p><p className="mt-1 text-xs leading-5 text-[#5b7483]">Informações importantes sempre à mão.</p></div>
          </div>
        </div>
      </section>

      <section id="plataforma" className="border-t border-[#042A40]/[0.07] bg-white px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#006BCC]">PLATAFORMA DH FINANCEIRA</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Organização que acompanha o seu dia.</h2>
            <p className="mt-4 text-base leading-7 text-[#456477]">Uma visão integrada para facilitar o atendimento e apoiar decisões com informação clara.</p>
          </div>
          <div className="mt-11 grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-[#042A40]/[0.09] bg-[#F5F7FA] p-6 sm:p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D8E8F7] text-[#006BCC]"><Icon size={22} /></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#557080]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#042A40] px-5 py-9 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <img src="/brand/dh-financeira-horizontal-white.png" alt="DH Financeira" className="h-10 w-auto self-start object-contain" loading="lazy" />
          <p className="text-xs text-white/65">© {new Date().getFullYear()} DH Financeira. Todos os direitos reservados.</p>
          <Link to="/login" className="text-sm font-medium text-[#00B6EF] hover:text-white">Acessar sistema</Link>
        </div>
      </footer>
    </main>
  );
}
