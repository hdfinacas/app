import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, normalizeTier, tierHasAutomations, type PlanTier } from "@/lib/plans";

export function usePlan() {
  const { profile, isPlatformAdmin } = useAuth();

  return useMemo(() => {
    // O dono do app não paga plano: enxerga tudo.
    const tier: PlanTier = isPlatformAdmin ? "completo" : normalizeTier(profile?.plan_tier);
    return {
      tier,
      plan: PLANS[tier],
      hasAutomations: isPlatformAdmin || tierHasAutomations(tier),
      isEssencial: !isPlatformAdmin && tier === "essencial",
    };
  }, [profile?.plan_tier, isPlatformAdmin]);
}
