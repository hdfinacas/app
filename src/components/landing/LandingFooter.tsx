import { Link } from "react-router-dom";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import defaultLogo from "@/assets/credmais-mark.svg";
import { Mail, Phone, MapPin } from "lucide-react";

const LandingFooter = () => {
  const { config } = useWhiteLabel();
  const brandTitle = config.companyName || "CredMais App";
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="pt-16 pb-10 bg-background border-t border-border">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img
                src={config.companyLogo || defaultLogo}
                alt={brandTitle}
                width={40}
                height={40}
                loading="lazy"
                className="w-10 h-10 object-contain"
              />
              <span className="font-editorial text-xl text-foreground">{brandTitle}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O sistema completo para quem empresta dinheiro: clientes, contratos, parcelas e cobrança
              automática. Mais controle, menos calote e mais lucro no fim do mês.
            </p>
          </div>

          <nav aria-label="Navegação do rodapé">
            <h3 className="text-sm font-bold text-foreground mb-4">Navegação</h3>
            <ul className="space-y-3">
              {[
                { label: "Manifesto", href: "#home" },
                { label: "Plataforma", href: "#features" },
                { label: "Planos", href: "#pricing" },
                { label: "Dúvidas", href: "#faq" },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-bold text-foreground mb-4">Acesso</h3>
            <ul className="space-y-3">
              {[
                { label: "Entrar no painel", to: "/login" },
                { label: "Portal do cliente", to: "/portal" },
                { label: "Portal do investidor", to: "/portal-investidor" },
                { label: "Assinar agora", to: "/checkout" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground mb-4">Contato</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <Phone size={15} className="text-primary mt-0.5 flex-shrink-0" />
                <a href="https://wa.me/5511964541758" className="hover:text-foreground transition-colors">
                  (11) 96454-1758
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail size={15} className="text-primary mt-0.5 flex-shrink-0" />
                <span>contato@credmaisapp.com</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin size={15} className="text-primary mt-0.5 flex-shrink-0" />
                <span>São Paulo · SP · Brasil</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            © {year} {brandTitle}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/termos" className="text-xs text-subtle hover:text-foreground transition-colors">
              Termos de uso
            </Link>
            <Link to="/privacidade" className="text-xs text-subtle hover:text-foreground transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
