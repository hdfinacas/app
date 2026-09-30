/**
 * Shared shell for the Vexon-style marketing pages.
 * Reuses the landing page's particle background, preloader-free entrance
 * animation and Lenis smooth scrolling.
 */

import React, { useEffect } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ParticleOrb } from "@/components/vexon/ParticleOrbLazy";
import { TextEffect } from "@/components/vexon/ui/text-effect";
import Lenis from "lenis";

export const NAV_ITEMS = [
  { label: "Inteligência de cobrança", to: "/inteligencia" },
  { label: "Sobre o CredMais", to: "/sobre-credmais" },
  { label: "Nossa missão", to: "/missao" },
  { label: "Planos", to: "/planos" },
];

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

export const itemVariants: Variants = {
  hidden: { y: 80, opacity: 0, rotateX: 12, scale: 0.94, filter: "blur(10px)" },
  visible: {
    y: 0,
    opacity: 1,
    rotateX: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export const Reveal = ({
  children,
  className = "",
  amount = 0.3,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount }}
    className={className}
  >
    {children}
  </motion.div>
);

export const Item = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div variants={itemVariants} className={className}>
    {children}
  </motion.div>
);

export const DiamondStar = ({ className }: { className?: string }) => (
  <motion.div
    animate={{ rotateY: 360 }}
    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
    className={className}
    style={{ transformStyle: "preserve-3d" }}
  >
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="currentColor">
      <path d="M50 0C50 35 65 50 100 50C65 50 50 65 50 100C50 65 35 50 0 50C35 50 50 35 50 0Z" />
    </svg>
  </motion.div>
);

interface VexonShellProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}

export function VexonShell({ eyebrow, title, intro, children }: VexonShellProps) {
  const location = useLocation();
  const { scrollY } = useScroll();
  const bgScale = useTransform(scrollY, [0, 900], [1, 1.18]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });
    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-black font-sans selection:bg-white selection:text-black">
      <motion.div style={{ scale: bgScale }} className="fixed inset-0 z-0 origin-center">
        <ParticleOrb className="h-full w-full" start />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: "easeOut" }}>
        {/* Nav */}
        <nav className="fixed top-0 left-0 z-50 flex w-full items-start justify-between px-6 py-6 md:px-10 md:py-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6 md:gap-10">
            <Link to="/" className="font-logo text-2xl font-bold tracking-tighter text-white md:text-3xl">
              CREDMAIS
            </Link>
            <Link
              to="/"
              className="hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#E6E6E6] opacity-50 transition-opacity hover:opacity-100 md:flex"
            >
              <ArrowLeft className="h-3 w-3" /> Início
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-2">
            {NAV_ITEMS.map((n) => {
              const active = location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`group flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest transition-colors ${
                    active ? "text-white" : "text-[#8E9299] hover:text-white"
                  }`}
                >
                  {n.label}
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </motion.div>
        </nav>

        <div className="relative z-10">
          {/* Hero */}
          <section className="flex min-h-[85vh] items-center px-6 pt-40 pb-24 md:px-10 md:pt-44">
            <Reveal className="grid w-full grid-cols-1 lg:grid-cols-12 lg:gap-10">
              <div className="flex flex-col justify-center lg:col-span-8">
                <Item className="mb-6 font-mono text-[10px] tracking-[0.2em] text-[#E6E6E6] md:text-[11px]">
                  [ {eyebrow} ]
                </Item>
                <h1 className="font-display text-[11vw] font-bold uppercase leading-[0.92] tracking-tight text-white md:text-[6vw] lg:text-[5vw]">
                  <div className="flex items-center gap-4 md:gap-8">
                    <DiamondStar className="h-[0.6em] w-[0.6em] shrink-0 text-white" />
                    <TextEffect preset="blur" per="char" as="span" className="drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                      {title}
                    </TextEffect>
                  </div>
                </h1>
              </div>
              <div className="flex flex-col justify-end gap-8 pt-12 lg:col-span-4">
                <Item>
                  <p className="max-w-sm text-xs leading-relaxed text-[#E6E6E6] md:text-sm">{intro}</p>
                </Item>
                <Item className="flex flex-wrap items-center gap-4 md:gap-6">
                  <Link
                    to="/checkout"
                    className="group relative overflow-hidden rounded-sm border border-white/30 bg-black/60 px-6 py-3 text-xs font-medium tracking-wide text-white backdrop-blur-3xl transition-all hover:bg-black/80 md:px-8 md:py-4 md:text-sm"
                  >
                    <div className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-white/60 transition-transform group-hover:scale-110" />
                    <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white/60 transition-transform group-hover:scale-110" />
                    <span className="relative z-10 uppercase tracking-widest">Comece a lucrar hoje</span>
                  </Link>
                  <Link to="/login" className="text-xs font-medium tracking-wide text-white transition-colors hover:opacity-70 md:text-sm">
                    Já sou cliente
                  </Link>
                </Item>
              </div>
            </Reveal>
          </section>

          {children}

          {/* Footer */}
          <footer className="relative z-10 border-t border-white/5 bg-black/60 px-6 py-12 backdrop-blur-3xl md:px-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="font-logo text-xl font-bold tracking-tighter text-white opacity-80">CREDMAIS®</div>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#E6E6E6] opacity-50">
                  Cobrança inteligente para quem empresta. Contratos, parcelas e WhatsApp em um só lugar.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                {NAV_ITEMS.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="text-[11px] font-medium uppercase tracking-widest text-[#8E9299] transition-colors hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
                <a
                  href="https://wa.me/5511964541758"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white opacity-60 transition-opacity hover:opacity-100"
                >
                  (11) 96454-1758
                </a>
              </div>
            </div>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}

/** Section with the same border/blur language as the landing page. */
export const VexonSection = ({
  id,
  label,
  children,
  className = "",
}: {
  id?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    id={id}
    className={`border-t border-white/5 bg-black/40 px-6 py-20 backdrop-blur-3xl md:px-10 md:py-28 ${className}`}
  >
    {label && (
      <div className="mb-10 font-mono text-[11px] uppercase tracking-[0.2em] text-[#E6E6E6] opacity-50">/ {label}</div>
    )}
    {children}
  </section>
);
