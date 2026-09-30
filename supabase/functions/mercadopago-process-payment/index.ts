// Checkout Transparente — processa pagamento gerado pelo Payment Brick do Mercado Pago
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/introduction
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard as rateLimitGuard } from "../_shared/rate_limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Valores SEMPRE fixados no servidor. O cliente só escolhe o tier.
const PLANS = {
  essencial: {
    id: "credmais-essencial",
    title: "CredMais App — Plano Essencial (Mensal)",
    amount: 199,
  },
  completo: {
    id: "credmais-completo",
    title: "CredMais App — Plano Completo (Mensal)",
    amount: 299,
  },
} as const;

type PlanTier = keyof typeof PLANS;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Endpoint é público por necessidade (o checkout acontece antes de existir conta),
  // então o freio é por IP: uma pessoa comprando faz 1-2 tentativas. Acima disso é
  // abuso — cada chamada cria uma cobrança de verdade na conta do Mercado Pago.
  const rl = await rateLimitGuard(req, "mp-pay", 6, 0.05, corsHeaders);
  if (rl) return rl;

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return json({ error: "payment_unavailable" }, 500);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Payload vem do Payment Brick { formData, selectedPaymentMethod }
  const formData = payload?.formData ?? payload;
  const selected: string = payload?.selectedPaymentMethod ?? formData?.payment_method_id ?? "";
  const extraEmail: string | undefined = payload?.email;
  const extraName: string | undefined = payload?.name;
  const deviceId: string | undefined = payload?.deviceId;
  const extraDocType: string | undefined = payload?.docType; // "CPF" | "CNPJ"
  const extraDoc: string | undefined = payload?.doc; // digits only
  const extraWhats: string | undefined = payload?.whatsapp; // digits only
  const planTier: PlanTier = payload?.planTier === "essencial" ? "essencial" : "completo";
  const PLAN = PLANS[planTier];

  if (!formData) return json({ error: "missing_form_data" }, 400);

  const payerIn = formData.payer ?? {};
  const payerEmail: string = payerIn.email ?? extraEmail ?? "";
  const firstName = payerIn.first_name ?? (extraName ? extraName.split(" ")[0] : undefined);
  const lastName = payerIn.last_name ?? (extraName ? extraName.split(" ").slice(1).join(" ") || undefined : undefined);
  const identification = payerIn.identification ?? (extraDoc && extraDocType ? { type: extraDocType, number: extraDoc } : undefined);
  let phone: { area_code: string; number: string } | undefined;
  if (extraWhats && extraWhats.length >= 10) {
    phone = { area_code: extraWhats.slice(0, 2), number: extraWhats.slice(2) };
  }

  // Corpo /v1/payments conforme docs oficiais MP
  const body: Record<string, unknown> = {
    // SEGURANÇA (C3): o valor é SEMPRE fixado no servidor. Nunca usar
    // formData.transaction_amount (controlado pelo cliente) — senão qualquer um
    // pagaria R$ 0,01 pelo plano e ativaria a assinatura.
    transaction_amount: PLAN.amount,
    description: PLAN.title,
    external_reference: PLAN.id,
    statement_descriptor: "CREDMAIS",
    binary_mode: false,
    capture: true,
    metadata: { plan: PLAN.id, plan_tier: planTier, email: payerEmail || null, whatsapp: extraWhats || null, doc_type: extraDocType || null, doc: extraDoc || null },
    notification_url: `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/mercadopago-webhook`,
    // additional_info aumenta a taxa de aprovação (docs MP)
    additional_info: {
      items: [
        {
          id: PLAN.id,
          title: PLAN.title,
          description: "Assinatura mensal recorrente - CredMais App",
          category_id: "services",
          quantity: 1,
          unit_price: PLAN.amount,
        },
      ],
      payer: {
        first_name: firstName,
        last_name: lastName,
        ...(phone ? { phone } : {}),
      },
    },
  };

  const method = (formData.payment_method_id ?? selected ?? "").toString();

  if (formData.token) {
    // Cartão de crédito/débito (token gerado pelo Brick)
    body.token = formData.token;
    body.installments = Number(formData.installments ?? 1);
    if (formData.payment_method_id) body.payment_method_id = formData.payment_method_id;
    if (formData.issuer_id) body.issuer_id = formData.issuer_id;
  } else if (method === "pix" || selected === "pix") {
    body.payment_method_id = "pix";
    // Pix: expira em 30 minutos
    (body as any).date_of_expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  } else if (method === "bolbradesco" || selected === "bolbradesco" || method === "boleto" || selected === "ticket") {
    body.payment_method_id = "bolbradesco";
    // Boleto: vence em 3 dias
    (body as any).date_of_expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  } else if (method) {
    body.payment_method_id = method;
  }

  // Payer é obrigatório (docs MP: email + identification.type/number para Pix/Boleto)
  body.payer = {
    email: payerEmail || "cliente@credmaisapp.com",
    first_name: firstName,
    last_name: lastName,
    identification,
    address: payerIn.address,
    ...(phone ? { phone } : {}),
  };

  try {
    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    };
    // Device fingerprint recomendado pela doc MP para melhor aprovação em cartão
    if (deviceId) mpHeaders["X-meli-session-id"] = deviceId;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: mpHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("[mercadopago-process-payment] falha do provedor", mpRes.status, mpRes.headers.get("x-request-id"));
      return json({ error: "payment_provider_error" }, 502);
    }

    return json({
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      payment_method_id: data.payment_method_id,
      point_of_interaction: data.point_of_interaction ?? null,
      transaction_details: data.transaction_details ?? null,
    });
  } catch (error) {
    console.error("[mercadopago-process-payment] indisponível", error instanceof Error ? error.name : "unknown");
    return json({ error: "payment_unavailable" }, 500);
  }
});
