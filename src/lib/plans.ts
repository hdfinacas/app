export type PlanTier = "essencial" | "completo";

export interface PlanDef {
  tier: PlanTier;
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  tagline: string;
  features: string[];
  missing?: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanTier, PlanDef> = {
  essencial: {
    tier: "essencial",
    id: "credmais-essencial",
    name: "Essencial",
    price: 199,
    priceLabel: "199",
    tagline: "Gestão completa da carteira, sem automações.",
    features: [
      "Clientes e contratos ilimitados",
      "Cobranças, parcelas, juros e multas automáticas no cálculo",
      "Portal do cliente e portal do cobrador",
      "Relatórios de lucro e inadimplência",
      "Investidores e carteira",
      "App no celular, tablet e computador",
      "Suporte no WhatsApp",
    ],
    missing: [
      "Agente de IA no WhatsApp",
      "Automações e cobrança automática",
      "Inbox de WhatsApp dentro do app",
    ],
  },
  completo: {
    tier: "completo",
    id: "credmais-completo",
    name: "Completo",
    price: 299,
    priceLabel: "299",
    tagline: "Tudo do Essencial + automações e agente de IA.",
    highlight: true,
    features: [
      "Tudo do plano Essencial",
      "Agente de IA de cobrança e atendimento 24/7",
      "Cobrança automática no WhatsApp",
      "Inbox de WhatsApp dentro do app",
      "Automações, réguas e disparos programados",
      "Painel de performance do bot",
      "Suporte prioritário",
    ],
  },
};

export const PLAN_LIST: PlanDef[] = [PLANS.essencial, PLANS.completo];

export function normalizeTier(value?: string | null): PlanTier {
  return value === "essencial" ? "essencial" : "completo";
}

/** Recursos exclusivos do plano Completo */
export function tierHasAutomations(tier: PlanTier) {
  return tier === "completo";
}

export function planFromAmount(amount?: number | null): PlanTier {
  const v = Number(amount ?? 0);
  if (v >= PLANS.completo.price - 0.01) return "completo";
  return "essencial";
}
