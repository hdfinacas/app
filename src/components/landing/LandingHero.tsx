import { Credinho } from "@/components/brand/Credinho";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Zap, MessageSquareText } from "lucide-react";
import defaultLogo from "@/assets/credmais-mark.svg";

const promises = [
  "Você sabe quem deve, quanto deve e desde quando — sem abrir planilha.",
  "A cobrança sai sozinha no WhatsApp, com PIX e link para o cliente pagar.",
  "O cliente resolve tudo no portal e para de te procurar fora de hora.",
];

const LandingHero = () => {
  return (
    <section id="home" className="relative overflow-hidden pt-32 pb-16 lg:pt-40 lg:pb-24">
      <div className="absolute inset-0 rule-grid opacity-70 pointer-events-none" aria-hidden />
      <motion.div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[780px] h-[520px] rounded-full bg-primary/[0.10] blur-[120px] pointer-events-none"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-5 sm:px-6 relative">
        {/* Faixa superior editorial */}
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span className="text-primary">CredMais App</span>
          <span className="flex-1 gold-line" />
          <span className="hidden sm:inline">Gestão de empréstimos</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end mt-8" data-hero>
          <div className="lg:col-span-7 space-y-7">
            <h1 className="font-editorial text-[clamp(2.8rem,7.5vw,5.5rem)] leading-[0.95] text-foreground">
              Empreste com a
              <br />
              <span className="gold-text italic">visão completa</span>
              <br />
              e receba em dia.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              O sistema que organiza seus contratos, calcula os juros de atraso sozinho e cobra
              cada cliente por você no WhatsApp. Você deixa a planilha e passa a operar como
              empresa.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/checkout"
                  className="group inline-flex w-full items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold"
                >
                  Quero receber em dia
                  <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <a
                  href="https://wa.me/5511964541758"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 px-8 py-4 rounded-full border border-border text-foreground font-semibold hover:border-primary/50 transition-colors"
                >
                  <MessageSquareText size={17} className="text-primary" />
                  Falar no WhatsApp
                </a>
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-primary" /> Pagamento via Mercado Pago
              </span>
              <span className="flex items-center gap-2">
                <Zap size={15} className="text-primary" /> Ativo em minutos
              </span>
            </div>
          </div>

          {/* Retrato do mascote */}
          <div className="lg:col-span-5" data-hero-panel>
            <div className="relative rounded-[2rem] overflow-hidden border border-border">
              <Credinho priority className="mx-auto w-[180px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent pointer-events-none" />
              <img
                src={defaultLogo}
                alt=""
                aria-hidden
                width={96}
                height={96}
                loading="lazy"
                className="absolute top-5 left-5 w-14 h-14 rounded-xl object-cover opacity-90 ring-1 ring-primary/35"
              />
              <p className="absolute bottom-5 left-6 right-6 font-editorial text-xl text-foreground">
                Nada passa despercebido.
              </p>
            </div>
          </div>
        </div>

        {/* Promessas — sem métricas, só resultado */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {promises.map((p) => (
            <p
              key={p}
              className="bg-card p-6 sm:p-7 text-sm text-muted-foreground leading-relaxed"
            >
              <span className="block w-6 gold-line mb-4" />
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
