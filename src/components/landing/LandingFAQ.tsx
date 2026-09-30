import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. É tudo no navegador, no computador ou no celular. Você entra, cadastra seus clientes e já começa a operar.",
  },
  {
    q: "Como funcionam os juros de atraso?",
    a: "O sistema aplica o juro de atraso automaticamente a cada dia, no percentual que você configurar, e mostra o detalhamento parcela por parcela.",
  },
  {
    q: "O cliente consegue ver o que deve?",
    a: "Sim. Ele acessa o portal somente com o CPF e vê parcelas, PIX, comprovantes e pode pedir negociação.",
  },
  {
    q: "A cobrança no WhatsApp é automática?",
    a: "No plano Completo sim: réguas diárias, lembretes antes do vencimento e agente de IA respondendo o cliente 24h.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. A assinatura é mensal, sem fidelidade, e você mantém acesso até o fim do período pago.",
  },
];

const LandingFAQ = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary">Dúvidas</span>
            <h2 className="font-editorial text-[clamp(2rem,4vw,3rem)] leading-[1.05] text-foreground mt-4">
              O que perguntam antes de assinar.
            </h2>
          </div>

          <div className="lg:col-span-8 divide-y divide-border border-t border-b border-border">
            {faqs.map((faq, i) => {
              const isOpen = open === i;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-6 py-6 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-editorial text-xl sm:text-2xl text-foreground">{faq.q}</span>
                    <Plus
                      size={20}
                      className={`text-primary flex-shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-6 max-w-2xl">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingFAQ;
