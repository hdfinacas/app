// Follow-up automático: cutuca clientes que pararam de responder no meio da conversa.
// Disparado por pg_cron a cada 30min.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSharedSecret } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLLOWUPS = [
  "Oi! 👋 Você ainda está aí? Posso te ajudar com mais alguma coisa?",
  "Olá! Só passando pra saber se você precisa de algo mais. 😊",
  "Oi, tudo bem? Notei que paramos de conversar. Posso ajudar em algo? 🤝",
];
const pick = () => FOLLOWUPS[Math.floor(Math.random() * FOLLOWUPS.length)];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // SEGURANÇA (M4): cron protegido por segredo obrigatório.
  if (!checkSharedSecret(req, "CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Conversas com cliente parado entre 6h e 48h, sem follow-up enviado, bot ativo, não bloqueada
    const { data: convos, error: claimError } = await supabase.rpc("claim_whatsapp_followups", { _limit: 50 });
    if (claimError) throw claimError;

    if (!convos?.length) {
      return new Response(JSON.stringify({ status: "ok", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const c of convos) {
      // Um cliente sem nenhuma parcela com saldo não recebe follow-up automático.
      // Isso também cobre cadastros antigos cujo status da parcela não foi
      // atualizado, mas paid_amount já quitou integralmente o valor.
      if (c.client_id) {
        const { data: openRows } = await supabase
          .from("contract_installments")
          .select("amount,paid_amount,status,contracts(status)")
          .eq("user_id", c.user_id)
          .eq("client_id", c.client_id)
          .not("status", "in", '("paid","cancelled")');
        const hasBalance = (openRows || []).some((row: any) => {
          const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
          return ["active", "overdue"].includes(String(contract?.status || "").toLowerCase())
            && Number(row.amount || 0) - Number(row.paid_amount || 0) > 0.009;
        });
        if (!hasBalance) {
          await supabase.from("whatsapp_conversations").update({
            followup_sent_at: new Date().toISOString(), followup_claimed_at: null,
          }).eq("id", c.id);
          continue;
        }
      }

      // Busca settings do dono da conversa
      const { data: settings } = await supabase
        .from("settings")
        .select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance, bot_enabled")
        .eq("user_id", c.user_id)
        .single();

      if (!settings?.bot_enabled || !settings.whatsapp_api_url || !settings.whatsapp_api_key) {
        await supabase.from("whatsapp_conversations").update({ followup_claimed_at: null }).eq("id", c.id);
        continue;
      }

      const instance = c.instance || settings.whatsapp_instance;
      if (!instance) {
        await supabase.from("whatsapp_conversations").update({ followup_claimed_at: null }).eq("id", c.id);
        continue;
      }

      const text = pick();
      try {
        const res = await fetch(
          `${settings.whatsapp_api_url.replace(/\/$/, "")}/message/sendText/${instance}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: settings.whatsapp_api_key },
            body: JSON.stringify({ number: c.jid, text, delay: 500 }),
          },
        );
        if (!res.ok) {
          console.error("send fail", c.id, await res.text());
          await supabase.from("whatsapp_conversations").update({ followup_claimed_at: null }).eq("id", c.id);
          continue;
        }

        await supabase.from("whatsapp_messages").insert({
          conversation_id: c.id,
          user_id: c.user_id,
          direction: "out",
          sender: "bot",
          message_type: "text",
          content: text,
          metadata: { followup: true },
        });

        await supabase.from("whatsapp_conversations").update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 200),
          last_message_from: "bot",
          followup_sent_at: new Date().toISOString(),
          followup_claimed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);

        sent++;
      } catch (e) {
        console.error("followup error", c.id, e);
        await supabase.from("whatsapp_conversations").update({ followup_claimed_at: null }).eq("id", c.id);
      }
    }

    return new Response(JSON.stringify({ status: "ok", processed: sent, candidates: convos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-followup error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
