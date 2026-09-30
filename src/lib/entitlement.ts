export interface ProfileEntitlement {
  subscriptionType?: string | null;
  trialEndsAt?: string | null;
  subscriptionExpiresAt?: string | null;
}

const isFutureDate = (value: string | null | undefined, now: number) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > now;
};

/** Regra única de acesso baseada no perfil; bloqueio administrativo é avaliado à parte. */
export const hasProfileEntitlement = (
  profile: ProfileEntitlement | null | undefined,
  now = Date.now(),
) => Boolean(
  profile?.subscriptionType === "lifetime"
  || isFutureDate(profile?.trialEndsAt, now)
  || isFutureDate(profile?.subscriptionExpiresAt, now),
);
