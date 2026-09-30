import { motion } from "framer-motion";

const words = [
  "Contratos",
  "Parcelas",
  "Juros diários",
  "Cobrança no WhatsApp",
  "Portal do cliente",
  "Investidores",
  "Relatórios",
  "Agente de IA",
];

const LandingMarquee = () => {
  const loop = [...words, ...words];

  return (
    <section className="relative border-y border-border py-5 overflow-hidden bg-secondary/40">
      <motion.div
        className="flex gap-10 w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {loop.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="flex items-center gap-10 text-sm uppercase tracking-[0.24em] text-muted-foreground whitespace-nowrap"
          >
            {w}
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
          </span>
        ))}
      </motion.div>
    </section>
  );
};

export default LandingMarquee;
