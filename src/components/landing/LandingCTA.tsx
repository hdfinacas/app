import { Link } from "react-router-dom";
import { Credinho } from "@/components/brand/Credinho";
import { ArrowUpRight } from "lucide-react";
import defaultLogo from "@/assets/credmais-mark.svg";

const LandingCTA = () => {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border obsidian-card px-6 py-16 sm:px-14 sm:py-20 text-center">
          <div className="absolute inset-0 rule-grid opacity-40 pointer-events-none" aria-hidden />
          <Credinho pose="results" className="mx-auto w-[80px]" />
          <h2 className="relative font-editorial text-[clamp(2rem,5vw,3.6rem)] leading-[1.05] text-foreground mt-7 max-w-3xl mx-auto">
            Assuma o controle da sua carteira ainda hoje.
          </h2>
          <p className="relative text-muted-foreground mt-5 max-w-xl mx-auto">
            Configure em minutos, importe seus clientes e deixe a cobrança rodar sozinha.
          </p>
          <div className="relative flex flex-col sm:flex-row gap-3 justify-center mt-9">
            <Link
              to="/checkout"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold"
            >
              Assinar agora
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <a
              href="https://wa.me/5511964541758"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-border text-foreground font-semibold hover:border-primary/50 transition-colors"
            >
              Tirar dúvidas
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingCTA;
