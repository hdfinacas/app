export type AccessSource = "trial" | "subscription" | null;

const timestamp = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

/** Selects the effective (latest) access deadline without preferring an expired subscription. */
export const resolveProfileAccessEnd = (
  trialEndsAt?: string | null,
  subscriptionExpiresAt?: string | null,
): { value: string | null; source: AccessSource } => {
  const trialTime = timestamp(trialEndsAt);
  const subscriptionTime = timestamp(subscriptionExpiresAt);
  if (trialTime === Number.NEGATIVE_INFINITY && subscriptionTime === Number.NEGATIVE_INFINITY) {
    return { value: null, source: null };
  }
  if (trialTime >= subscriptionTime) return { value: trialEndsAt!, source: "trial" };
  return { value: subscriptionExpiresAt!, source: "subscription" };
};
