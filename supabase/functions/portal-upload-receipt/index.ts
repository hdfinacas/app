import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guard as rateLimit } from "../_shared/rate_limit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });
  const rl = await rateLimit(req, "portal-receipt", 10, 10 / 60, corsHeaders);
  if (rl) return rl;


  try {
    const body = await req.json();
    const session_token = String(body.session_token || "").trim();
    const installment_id = String(body.installment_id || "");
    const content_type = String(body.content_type || "");
    const filename = String(body.filename || "comprovante");
    const file_base64 = String(body.file_base64 || "");

    if (!session_token || !installment_id || !file_base64 || !ALLOWED.includes(content_type)) {
      return new Response(JSON.stringify({ error: "Dados inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inst, error: instErr } = await supabase
      .from("contract_installments")
      .select("id, user_id, client_id, contract_id, installment_number")
      .eq("id", installment_id)
      .maybeSingle();

    if (instErr || !inst) throw new Error("Parcela não encontrada");

    // Autorização.
    //
    const { data: sess } = await supabase
      .from("portal_sessions")
      .select("client_id")
      .eq("token", session_token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const autorizado = !!sess && sess.client_id === inst.client_id;

    if (!autorizado) {
      return new Response(JSON.stringify({ error: "Sem permissão para esta parcela" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64
    const bin = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    if (bin.length > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Arquivo maior que 6MB" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = content_type === "application/pdf" ? "pdf"
      : content_type === "image/png" ? "png"
      : content_type === "image/webp" ? "webp" : "jpg";
    const path = `portal-receipts/${inst.client_id}/${installment_id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("uploads").upload(path, bin, {
      contentType: content_type, upsert: true,
    });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || path;

    const { error: updateErr } = await supabase.from("contract_installments")
      .update({ receipt_url: url, receipt_storage_path: path, receipt_review_status: "pending" })
      .eq("id", installment_id);
    if (updateErr) {
      await supabase.storage.from("uploads").remove([path]);
      throw updateErr;
    }

    await supabase.from("client_notifications").upsert({
      client_id: inst.client_id,
      user_id: (inst as any).user_id,
      installment_id,
      type: "receipt_uploaded",
      title: "Comprovante enviado",
      message: `Comprovante da parcela #${inst.installment_number} recebido e aguardando conferência.`,
      metadata: { storage_path: path },
    }, { onConflict: "installment_id,type,dedupe_day", ignoreDuplicates: true });

    await supabase.from("audit_logs").insert({
      user_id: (inst as any).user_id,
      action: "receipt_uploaded",
      entity_type: "contract_installment",
      entity_id: installment_id,
      details: { client_id: inst.client_id, contract_id: (inst as any).contract_id, storage_path: path },
    });

    return new Response(JSON.stringify({ ok: true, url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
