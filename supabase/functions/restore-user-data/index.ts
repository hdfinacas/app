import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Keep this list aligned with restore_user_backup_atomic().
const USER_TABLES = [
  "clients", "installments", "investors", "collectors", "vehicles", "stock_items", "settings",
  "business_assets", "business_operations", "business_receivables", "business_payments",
  "loan_presets", "investor_loans", "contracts", "loan_collateral", "contract_events",
  "contract_signature_events", "rentals", "goals", "notes", "todos", "contract_installments",
  "payment_promises", "investor_payments", "whatsapp_receipt_reviews", "transactions", "expenses", "profits",
  "collector_assignments", "subscriptions", "notifications", "client_notifications",
  "collection_attempts", "audit_logs", "bot_actions_log", "support_tickets",
  "support_ticket_messages", "whatsapp_conversations", "whatsapp_messages",
  "whatsapp_notes", "whatsapp_scheduled_messages", "message_templates", "leads",
  "pledges", "ai_conversations", "client_errors",
] as const;

const SECRET_FIELD = /(api.?key|access.?token|refresh.?token|password|credential|secret|(^|_)token($|_))/i;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const IMPORTS_FOLDER = "imports";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function rowsFromBackup(value: unknown, table: string): any[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`Formato inválido na tabela ${table}`);
  return value;
}

function sanitizeValue(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, SECRET_FIELD.test(key) ? null : sanitizeValue(child),
  ]));
}

async function checkIdOwnership(admin: any, dump: Record<string, any[]>, userId: string) {
  for (const table of USER_TABLES) {
    if (table === "support_ticket_messages") continue;
    const rows = dump[table] || [];
    // Keep PostgREST `in` filters small enough for its request URL limits.
    for (let offset = 0; offset < rows.length; offset += 100) {
      const ids = rows.slice(offset, offset + 100).map((row: any) => row.id).filter(Boolean);
      if (!ids.length) continue;
      const { data, error } = await admin.from(table).select("id,user_id").in("id", ids);
      if (error) throw new Error(`Não foi possível validar conflitos em ${table}`);
      if ((data || []).some((row: any) => row.user_id !== userId)) {
        throw new Error(`O backup contém um identificador já usado por outra conta (${table}). Nenhum dado foi alterado.`);
      }
    }
  }

  const messageRows = dump.support_ticket_messages || [];
  for (let offset = 0; offset < messageRows.length; offset += 100) {
    const ids = messageRows.slice(offset, offset + 100).map((row: any) => row.id).filter(Boolean);
    if (!ids.length) continue;
    const { data, error } = await admin.from("support_ticket_messages").select("id,ticket_id").in("id", ids);
    if (error) throw new Error("Não foi possível validar conflitos nas mensagens de suporte");
    const ticketIds = new Set((dump.support_tickets || []).map((ticket: any) => ticket.id));
    if ((data || []).some((row: any) => !ticketIds.has(row.ticket_id))) {
      throw new Error("O backup contém mensagens vinculadas a outra conta. Nenhum dado foi alterado.");
    }
  }
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

    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path : "";
    const confirm = body?.confirmar === "RESTAURAR";
    if (!path.startsWith(`${user.id}/${IMPORTS_FOLDER}/`) || !/^[\w-]+\/imports\/[\w.-]+\.json$/i.test(path)) {
      return json({ error: "invalid_backup_path" }, 400);
    }

    const admin = createClient(url, serviceKey);
    const { data: file, error: downloadError } = await admin.storage.from("backups").download(path);
    if (downloadError || !file) return json({ error: "backup_not_found" }, 404);
    if (file.size > MAX_BACKUP_BYTES) return json({ error: "backup_too_large", max_bytes: MAX_BACKUP_BYTES }, 413);

    let source: Record<string, any>;
    try { source = JSON.parse(await file.text()); }
    catch { return json({ error: "backup_invalid_json" }, 422); }
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return json({ error: "backup_invalid_format" }, 422);
    }

    // Aceita o formato completo novo, os backups automáticos v2 e a exportação
    // legada de portabilidade (_meta.user_id), para migrar contas entre projetos.
    const manifest = source._manifest ?? source._meta;
    const sourceUserId = manifest?.user_id;
    if (typeof sourceUserId !== "string" || !sourceUserId) return json({ error: "backup_missing_owner" }, 422);

    const dump: Record<string, any[]> = {};
    for (const table of USER_TABLES) {
      let rows: any[];
      try { rows = rowsFromBackup(source[table], table); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "backup_invalid_table" }, 422); }

      if (manifest?.counts?.[table] != null && manifest.counts[table] !== rows.length) {
        return json({ error: "backup_count_mismatch", table }, 422);
      }
      if (table === "support_ticket_messages") {
        const ownTicketIds = new Set(rowsFromBackup(source.support_tickets, "support_tickets")
          .filter((ticket: any) => ticket.user_id === sourceUserId).map((ticket: any) => ticket.id));
        rows = rows.filter((row: any) => row && ownTicketIds.has(row.ticket_id) && row.is_internal !== true);
      } else {
        if (rows.some((row: any) => !row || typeof row !== "object" || row.user_id !== sourceUserId)) {
          return json({ error: "backup_owner_mismatch", table }, 422);
        }
      }

      dump[table] = rows.map((row: any) => {
        const safe = { ...row };
        if (table !== "support_ticket_messages") safe.user_id = user.id;
        else if (safe.sender_id === sourceUserId) safe.sender_id = user.id;
        return sanitizeValue(safe);
      });
    }

    const sourceTickets = new Set(dump.support_tickets.map((ticket: any) => ticket.id));
    if (dump.support_ticket_messages.some((message: any) => !sourceTickets.has(message.ticket_id))) {
      return json({ error: "support_message_without_ticket" }, 422);
    }

    // The profile is intentionally limited to cosmetic fields. The destination
    // auth identity, email, plan, and admin flags always remain authoritative.
    const sourceProfile = source._account?.profile
      ?? (Array.isArray(source.profiles) ? source.profiles.find((p: any) => p.id === sourceUserId) : null);

    try { await checkIdOwnership(admin, dump, user.id); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "backup_conflict" }, 409); }

    const report = Object.fromEntries(USER_TABLES.map((table) => [table, {
      no_backup: dump[table]?.length ?? 0,
    }]));
    if (!confirm) return json({ mode: "preview", owner: user.email, report, writes: false });

    const { data: restored, error: restoreError } = await admin.rpc("restore_user_backup_atomic", {
      _user_id: user.id,
      _dump: dump,
    });
    if (restoreError) {
      console.error("restore-user-data database restore failed", restoreError.message);
      return json({ error: "restore_failed", detail: restoreError.message }, 409);
    }

    if (sourceProfile && typeof sourceProfile.name === "string") {
      const safeProfile: Record<string, unknown> = { name: sourceProfile.name.slice(0, 120) };
      if (typeof sourceProfile.avatar_url === "string") safeProfile.avatar_url = sourceProfile.avatar_url;
      const { error: profileError } = await admin.from("profiles").update(safeProfile).eq("id", user.id);
      if (profileError) console.error("restore-user-data safe profile update failed", profileError.message);
    }

    await admin.storage.from("backups").remove([path]);
    return json({
      mode: "restored",
      owner: user.email,
      report: Object.fromEntries(USER_TABLES.map((table) => [table, {
        no_backup: dump[table]?.length ?? 0,
        restored: Number((restored as any)?.counts?.[table] ?? 0),
      }])),
      atomic: true,
    });
  } catch (error) {
    console.error("restore-user-data error", error);
    return json({ error: error instanceof Error ? error.message : "restore_failed" }, 500);
  }
});
