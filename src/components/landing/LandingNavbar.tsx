import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import defaultLogo from "@/assets/credmais-mark.svg";

const navLinks = [
  { name: "Manifesto", href: "#home" },
  { name: "Plataforma", href: "#features" },
  { name: "Por que", href: "#why" },
  { name: "Planos", href: "#pricing" },
  { name: "Dúvidas", href: "#faq" },
];

const LandingNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { config } = useWhiteLabel();

  const logoSrc = config.companyLogo || defaultLogo;
  const brandTitle = config.companyName || "CredMais App";

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/80 backdrop-blur-xl py-2.5 border-b border-border" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-5 sm:px-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-left group"
          aria-label={brandTitle}
        >
          <span className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-secondary border border-border overflow-hidden">
            <img src={logoSrc} alt={brandTitle} width={44} height={44} className="w-8 h-8 object-contain" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-editorial text-xl text-foreground">{brandTitle}</span>
            <span className="text-[9px] text-muted-foreground tracking-[0.28em] uppercase mt-1">
              Crédito sob controle
            </span>
          </span>
        </button>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="relative text-[13px] uppercase tracking-[0.14em] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {link.name}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2.5"
          >
            Entrar
          </Link>
          <Link
            to="/checkout"
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Assinar
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-foreground p-2 -mr-2"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-5">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-base font-medium text-muted-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Link
                  to="/login"
                  className="text-center py-3 rounded-full border border-border text-foreground font-semibold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  to="/checkout"
                  className="text-center py-3 rounded-full bg-primary text-primary-foreground font-semibold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Assinar agora
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default LandingNavbar;
