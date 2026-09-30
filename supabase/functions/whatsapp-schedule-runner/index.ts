// Roda a cada minuto: envia mensagens agendadas cujo scheduled_for já passou.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSharedSecret } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_TIMEOUT_MESSAGE = "Atendimento encerrado por falta de resposta. Quando precisar continuar, envie uma nova mensagem para abrir o menu novamente.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // SEGURANÇA (M4): cron protegido por segredo obrigatório.
  if (!checkSharedSecret(req, "CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: jobs, error: claimError } = await supabase.rpc("claim_due_whatsapp_messages", { _limit: 50 });
  if (claimError) throw claimError;

  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    try {
      const { data: convo, error: convoError } = await supabase
        .from("whatsapp_conversations").select("*")
        .eq("id", job.conversation_id).eq("user_id", job.user_id).single();
      if (convoError || !convo) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: "conversation_not_found",
        }).eq("id", job.id);
        failed++; continue;
      }

      if (convo.blocked || (convo.bot_paused && job.purpose !== "manual" && job.purpose !== "session_timeout")) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "cancelled", error: "conversation_paused_or_blocked",
        }).eq("id", job.id);
        continue;
      }

      if (["collection", "service_followup"].includes(job.purpose) && job.client_id) {
        const { data: openRows } = await supabase.from("contract_installments")
          .select("amount,paid_amount,status,contracts(status)")
          .eq("user_id", job.user_id).eq("client_id", job.client_id)
          .not("status", "in", '("paid","cancelled")');
        const stillOwes = (openRows || []).some((row: any) => {
          const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
          return ["active", "overdue"].includes(String(contract?.status || "").toLowerCase())
            && Number(row.amount || 0) - Number(row.paid_amount || 0) > 0.009;
        });
        if (!stillOwes) {
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "cancelled", error: "debt_no_longer_exists",
          }).eq("id", job.id);
          continue;
        }
      }

      // Um job pode ter sido reivindicado no mesmo instante em que o cliente
      // respondeu. Confere o estado atual antes de encerrar para não mandar uma
      // mensagem de inatividade depois de uma resposta recente.
      if (job.text === SESSION_TIMEOUT_MESSAGE) {
        const scheduledAt = new Date(job.scheduled_for).getTime();
        const lastMessageAt = new Date(convo.last_message_at || 0).getTime();
        const stillInactive = convo.last_message_from === "bot" && lastMessageAt <= scheduledAt - 9 * 60_000;
        if (!stillInactive) {
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "cancelled", error: "conversation_became_active",
          }).eq("id", job.id);
          continue;
        }
      }

      const { data: settings, error: settingsError } = await supabase
        .from("settings").select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
        .eq("user_id", job.user_id).single();

      const apiUrl = (settings?.whatsapp_api_url || "").replace(/\/$/, "");
      const apiKey = settings?.whatsapp_api_key;
      const instance = convo.instance || settings?.whatsapp_instance;
      if (settingsError || !apiUrl || !apiKey || !instance) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: "whatsapp_not_configured",
        }).eq("id", job.id);
        failed++; continue;
      }

      const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: convo.jid, text: job.text, delay: 600 }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: `send_failed_${res.status}`,
        }).eq("id", job.id);
        failed++; continue;
      }

      const { error: messageError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: job.conversation_id, user_id: job.user_id,
        direction: "out", sender: job.text === SESSION_TIMEOUT_MESSAGE ? "bot" : "human",
        message_type: "text", content: job.text,
        metadata: { scheduled: true, scheduled_for: job.scheduled_for },
      });
      if (messageError) throw new Error("message_persist_failed");
      const { error: conversationError } = await supabase.from("whatsapp_conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: job.text.slice(0, 200),
        last_message_from: job.text === SESSION_TIMEOUT_MESSAGE ? "bot" : "human",
        updated_at: new Date().toISOString(),
      }).eq("id", job.conversation_id).eq("user_id", job.user_id);
      if (conversationError) throw new Error("conversation_persist_failed");
      const { error: statusError } = await supabase.from("whatsapp_scheduled_messages").update({
        status: "sent", sent_at: new Date().toISOString(),
      }).eq("id", job.id).eq("user_id", job.user_id);
      if (statusError) throw new Error("schedule_status_failed");
      sent++;
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "TimeoutError";
      await supabase.from("whatsapp_scheduled_messages").update({
        status: "failed", error: timedOut ? "provider_timeout" : "processing_failed",
      }).eq("id", job.id).eq("user_id", job.user_id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: jobs?.length || 0, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
