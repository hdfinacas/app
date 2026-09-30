import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSharedSecret } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // SEGURANÇA (M4): cron protegido por segredo obrigatório.
  if (!checkSharedSecret(req, "CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Parcelas em aberto cujo vencimento já passou (tabela correta: contract_installments)
    const { data: overdue, error: overdueErr } = await supabase
      .from("contract_installments")
      .select("id, user_id, client_id, amount, due_date, status, clients(name)")
      // Era `.eq("status","pending")`, mas o auto-late-fees roda às 03:00 e marca
      // as vencidas como "overdue" — quando este job rodava às 07:00 já não
      // sobrava quase nada para avisar. O alerta diário de inadimplência para o
      // credor praticamente nunca disparava.
      .not("status", "in", '("paid","cancelled")')
      .lt("due_date", todayStr);
    if (overdueErr) throw overdueErr;

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue installments" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user_id
    const byUser = new Map<string, any[]>();
    for (const inst of overdue) {
      const list = byUser.get(inst.user_id) || [];
      list.push(inst);
      byUser.set(inst.user_id, list);
    }

    let created = 0;
    for (const [userId, installments] of byUser) {
      // Check if notification already sent today
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "overdue_auto")
        .gte("created_at", `${todayStr}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const totalOverdue = installments.reduce((acc: number, i: any) => acc + Number(i.amount), 0);
      const clientNames = [...new Set(installments.map((i: any) => i.clients?.name || "Desconhecido"))];

      await supabase.from("notifications").insert({
        user_id: userId,
        message: `Você tem ${installments.length} parcela(s) atrasada(s) totalizando R$ ${totalOverdue.toFixed(2)}. Clientes: ${clientNames.join(", ")}`,
        type: "overdue_auto",
        from: "Sistema Automático",
        link: "/cobrancas",
      });
      created++;
    }

    return new Response(JSON.stringify({ message: `Created ${created} notifications` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
