// Admin: cria (ou promove) um usuário com acesso de teste por N dias.
//
// SEGURANÇA: exigia apenas um JWT válido — qualquer assinante logado podia
// emitir contas grátis e, para e-mail existente, trocar a senha do dono.
// Agora exige admin da plataforma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPlatformAdminUser, unauthorized } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const caller = await getPlatformAdminUser(req);
    if (!caller) return unauthorized(corsHeaders);

    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Prazo: o que veio na chamada ou o padrão da plataforma (/admin → Plataforma).
    let days = Number(body?.days);
    if (!Number.isFinite(days) || days <= 0) {
      const { data: platform } = await admin
        .from("platform_settings")
        .select("default_trial_days")
        .maybeSingle();
      days = Number(platform?.default_trial_days) || 3;
    }

    let userId: string | null = null;
    let existing: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 100 && !existing; page++) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) throw listError;
      existing = list.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (list.users.length < 1000) break;
    }
    if (existing) {
      userId = existing.id;
    } else {
      if (password.length < 8) {
        return new Response(JSON.stringify({ error: "password_required_for_new_account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name: name || email.split("@")[0] },
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    const { data: updatedProfiles, error: updateError } = await admin.from("profiles").update({
      // `trial_ends_at` identifica o teste. A periodicidade permanece em um
      // valor aceito também por bases antigas, que não conhecem o tipo `trial`.
      subscription_type: "monthly",
      subscription_expires_at: expiresAt,
      trial_ends_at: expiresAt,
      is_blocked: false,
    }).eq("id", userId).select("id");
    if (updateError) throw updateError;
    if (!updatedProfiles?.length) throw new Error("Perfil do usuário não foi encontrado para ativação.");

    return new Response(JSON.stringify({ ok: true, user_id: userId, expires_at: expiresAt, existing: !!existing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
