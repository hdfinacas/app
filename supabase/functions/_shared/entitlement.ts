import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EntitlementResult =
  | { ok: true }
  | { ok: false; status: 403 | 429; error: string; retryAfterMs?: number };

/** Server-side account-state and rate-limit gate for authenticated functions. */
export async function enforceEntitlement(
  userId: string,
  feature: string,
  options: { capacity?: number; windowSeconds?: number } = {},
): Promise<EntitlementResult> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !url) return { ok: false, status: 403, error: "entitlement_unavailable" };

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,is_blocked")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile || profile.is_blocked) return { ok: false, status: 403, error: "account_blocked" };
  const capacity = Math.max(1, options.capacity ?? 30);
  const windowSeconds = Math.max(60, options.windowSeconds ?? 3600);
  const { data: limit } = await admin.rpc("try_consume_rate_limit", {
    _key: `user:${userId}:${feature}`,
    _capacity: capacity,
    _refill_per_sec: capacity / windowSeconds,
  });
  if (limit && limit.allowed === false) {
    return { ok: false, status: 429, error: "rate_limit_exceeded", retryAfterMs: limit.retry_after_ms };
  }
  return { ok: true };
}

export function entitlementResponse(
  result: Exclude<EntitlementResult, { ok: true }>,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error: result.error, retry_after_ms: result.retryAfterMs }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
