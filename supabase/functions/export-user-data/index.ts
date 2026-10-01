import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Dados pertencentes ao assinante. As tabelas de autorização da plataforma,
// credenciais de login e tokens de integração são intencionalmente excluídos.
const USER_TABLES = [
  "clients", "installments", "investors", "collectors", "vehicles", "stock_items", "settings",
  "business_assets", "business_operations", "business_receivables", "business_payments",
  "loan_presets", "investor_loans", "contracts", "loan_collateral", "contract_events",
  "contract_signature_events", "rentals", "goals", "notes", "todos", "contract_installments",
  "payment_promises", "investor_payments", "whatsapp_receipt_reviews", "transactions", "expenses", "profits",
  "collector_assignments", "subscriptions", "notifications", "client_notifications",
  "collection_attempts", "audit_logs", "bot_actions_log", "support_tickets",
  "whatsapp_conversations", "whatsapp_messages", "whatsapp_notes",
  "whatsapp_scheduled_messages", "message_templates", "leads", "pledges",
  "ai_conversations", "client_errors",
] as const;

const SECRET_FIELD = /(api.?key|access.?token|refresh.?token|password|credential|secret|(^|_)token($|_))/i;

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

async function fetchAllForUser(admin: any, table: string, userId: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*")
      .eq("user_id", userId).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

function sanitizeValue(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, SECRET_FIELD.test(key) ? null : sanitizeValue(child),
  ]));
}

function sanitizeRows(rows: any[]): any[] {
  return rows.map((row) => sanitizeValue(row));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "no_auth" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Supabase secrets are not configured");

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const dump: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const table of USER_TABLES) {
      try {
        dump[table] = sanitizeRows(await fetchAllForUser(admin, table, user.id));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${table}: export_failed`);
      }
    }

    // As mensagens do suporte não têm user_id próprio; exportamos apenas as
    // mensagens públicas dos tickets do usuário, nunca notas internas.
    const { data: tickets, error: ticketError } = await admin.from("support_tickets")
      .select("id").eq("user_id", user.id);
    if (ticketError) errors.push(`support_tickets: ${ticketError.message}`);
    const ticketIds = (tickets || []).map((ticket: any) => ticket.id);
    const ticketMessages: any[] = [];
    for (let i = 0; i < ticketIds.length; i += 200) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from("support_ticket_messages").select("*")
          .in("ticket_id", ticketIds.slice(i, i + 200)).eq("is_internal", false)
          .range(from, from + 999);
        if (error) {
          errors.push(`support_ticket_messages: ${error.message}`);
          break;
        }
        ticketMessages.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
    }
    dump.support_ticket_messages = ticketMessages;

    if (errors.length) {
      console.error("user backup export incomplete", { userId: user.id, errors });
      return json({ error: "export_incomplete", details: errors }, 500);
    }

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("name, avatar_url").eq("id", user.id).maybeSingle();
    if (profileError) return json({ error: "profile_export_failed" }, 500);

    const counts = Object.fromEntries(Object.entries(dump)
      .map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
    dump._account = { email: user.email ?? null, profile: profile ?? null };
    dump._manifest = {
      format: "dh-financeira-user-backup",
      version: 3,
      exported_at: new Date().toISOString(),
      user_id: user.id,
      counts,
      excluded: ["passwords", "platform_roles", "API keys and bearer tokens", "binary storage files"],
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(dump), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup-completo-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("export-user-data error", error);
    return json({ error: error instanceof Error ? error.message : "export_failed" }, 500);
  }
});
