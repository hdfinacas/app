import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard as rateLimitGuard } from "../_shared/rate_limit.ts";
import { trustedCheckoutOrigin } from "../_shared/trusted_origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLANS = {
  essencial: { id: "credmais-essencial", title: "CredMais App — Plano Essencial (Mensal)", price: 199, currency: "BRL" },
  completo: { id: "credmais-completo", title: "CredMais App — Plano Completo (Mensal)", price: 299, currency: "BRL" },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  // Público por necessidade (checkout antes do login) — freio por IP contra abuso.
  const rl = await rateLimitGuard(req, "mp-pref", 10, 0.1, corsHeaders);
  if (rl) return rl;

  try {
    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "payment_unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body.email;
    const name: string | undefined = body.name;
    const planTier: "essencial" | "completo" = body.planTier === "essencial" ? "essencial" : "completo";
    const PLAN = PLANS[planTier];
    const origin = trustedCheckoutOrigin(req.headers.get("origin"));

    const preference = {
      items: [
        {
          id: PLAN.id,
          title: PLAN.title,
          description: `Assinatura mensal do CredMais App — plano ${planTier}.`,
          quantity: 1,
          currency_id: PLAN.currency,
          unit_price: PLAN.price,
        },
      ],
      payer: email ? { email, name: name ?? undefined } : undefined,
      back_urls: {
        success: `${origin}/checkout/sucesso`,
        failure: `${origin}/checkout/erro`,
        pending: `${origin}/checkout/pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "CREDMAIS",
      metadata: { plan: PLAN.id, plan_tier: planTier, email: email ?? null },
      notification_url: `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("[mercadopago-create-preference] falha do provedor", mpRes.status, mpRes.headers.get("x-request-id"));
      return new Response(
        JSON.stringify({ error: "payment_provider_error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[mercadopago-create-preference] indisponível", error instanceof Error ? error.name : "unknown");
    return new Response(JSON.stringify({ error: "payment_unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
