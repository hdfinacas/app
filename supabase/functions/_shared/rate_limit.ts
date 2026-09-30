// ============================================================================
// Rate limit distribuído (token bucket) para Edge Functions públicas.
// ----------------------------------------------------------------------------
// Consome tokens via RPC `public.try_consume_rate_limit` (tabela
// `public.rate_limit_hits`). Fallback em memória por isolate caso o RPC falhe.
// ============================================================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export interface RateLimitOptions {
  key: string;
  capacity: number;
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function memoryConsume(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cur = buckets.get(opts.key) || { tokens: opts.capacity, updatedAt: now };
  const elapsedSec = Math.max(0, (now - cur.updatedAt) / 1000);
  const tokens = Math.min(opts.capacity, cur.tokens + elapsedSec * opts.refillPerSec);
  if (tokens >= 1) {
    buckets.set(opts.key, { tokens: tokens - 1, updatedAt: now });
    return { allowed: true, remaining: Math.floor(tokens - 1), retryAfterMs: 0 };
  }
  buckets.set(opts.key, { tokens, updatedAt: now });
  const retryAfterMs = Math.ceil(((1 - tokens) / opts.refillPerSec) * 1000);
  return { allowed: false, remaining: 0, retryAfterMs };
}

export async function consume(opts: RateLimitOptions): Promise<RateLimitResult> {
  const sb = admin();
  if (sb) {
    try {
      const { data, error } = await sb.rpc("try_consume_rate_limit", {
        _key: opts.key,
        _capacity: opts.capacity,
        _refill_per_sec: opts.refillPerSec,
      });
      if (!error && data) {
        return {
          allowed: !!(data as any).allowed,
          remaining: Number((data as any).remaining ?? 0),
          retryAfterMs: Number((data as any).retry_after_ms ?? 0),
        };
      }
    } catch (_e) { /* fallback */ }
  }
  return memoryConsume(opts);
}

export function ipFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/** Aplica rate limit e retorna Response 429 pronta se estourou; senão null. */
export async function guard(
  req: Request,
  prefix: string,
  capacity: number,
  refillPerSec: number,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  const key = `${prefix}:${ipFromRequest(req)}`;
  const r = await consume({ key, capacity, refillPerSec });
  if (r.allowed) return null;
  return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)),
      ...headers,
    },
  });
}
