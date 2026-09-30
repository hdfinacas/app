import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, KeyRound, Ban, AlertTriangle, Scale, Mail } from "lucide-react";
import { Grain, SiteFooter, SiteHeader } from "@/components/site/SiteLayout";

const Termos = () => {
  useEffect(() => {
    document.title = "Termos de Uso — DH Financeira";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Termos de uso da plataforma DH Financeira e responsabilidades de uso.");
  }, []);

  const Section = ({ icon: Icon, title, children }: any) => (
    <section className="space-y-3 rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 md:p-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><Icon size={16} className="text-primary" /></div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );

  return (
    <div className="min-h-dvh bg-[#042A40] text-white">
      <Grain /><SiteHeader />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-16 sm:px-8 sm:py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"><ArrowLeft size={16} /> Voltar</Link>
        <header className="space-y-4 border-b border-white/10 pb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><FileText size={12} /> Plataforma DH Financeira</div>
          <h1 className="font-display text-[clamp(3rem,8vw,6rem)] font-semibold leading-[.88] tracking-[-.06em]">Termos de Uso</h1>
          <p className="text-sm text-white/65">Estes termos valem para quem usa a plataforma DH Financeira. Ao acessar uma conta, você concorda com estas condições.</p>
        </header>

        <Section icon={FileText} title="1. Sobre a plataforma">
          <p>A plataforma reúne ferramentas para organizar clientes, contratos, parcelas, cobranças e relatórios de uma operação financeira.</p>
          <p>A DH Financeira não concede crédito por meio deste sistema nem participa dos contratos firmados entre cada usuário e seus clientes.</p>
        </Section>

        <Section icon={KeyRound} title="2. Contas e acesso">
          <p>As contas são criadas e liberadas pelo administrador da DH Financeira. O administrador define o prazo de acesso e pode atualizar, suspender ou bloquear uma conta quando necessário.</p>
          <p>O usuário deve proteger suas credenciais e avisar o administrador se suspeitar de acesso indevido.</p>
        </Section>

        <Section icon={Scale} title="3. Responsabilidade sobre a operação">
          <p>O usuário é responsável pela legalidade da sua atividade, pelas taxas que pratica, pelos contratos que emite e pelo tratamento dado aos seus clientes.</p>
          <p>O Código de Defesa do Consumidor proíbe expor o devedor ao ridículo, constrangimento ou ameaça. Mensagens de cobrança podem ser configuradas pelo usuário, que responde pelo conteúdo enviado a partir da própria conta.</p>
        </Section>

        <Section icon={Ban} title="4. Uso proibido">
          <p>Não é permitido usar a plataforma para atividades ilícitas, cobranças abusivas, mensagens não solicitadas, acessar dados de outra conta ou compartilhar credenciais sem autorização.</p>
          <p>Contas usadas para esses fins podem ser suspensas pelo administrador.</p>
        </Section>

        <Section icon={AlertTriangle} title="5. Disponibilidade e limites">
          <p>A plataforma depende de serviços de hospedagem e comunicação de terceiros. Podem ocorrer interrupções ou falhas fora do controle da DH Financeira.</p>
          <p>Cálculos e valores exibidos servem como apoio. Confira as informações antes de usá-las em contratos ou cobranças.</p>
        </Section>

        <Section icon={Mail} title="6. Alterações e suporte">
          <p>Estes termos podem ser atualizados. Dúvidas sobre o acesso ou o uso da plataforma podem ser encaminhadas ao administrador.</p>
          <p>Consulte também a <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.</p>
        </Section>
        <p className="pt-2 text-center text-xs text-white/50">Última atualização: setembro de 2026.</p>
      </div>
      <SiteFooter />
    </div>
  );
};

export default Termos;
