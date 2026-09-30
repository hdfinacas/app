// Admin: cria (ou promove) um usuário com acesso vitalício.
//
// SEGURANÇA: esta função cria contas e, para e-mail já existente, TROCA A SENHA
// do dono daquele e-mail — é um caminho direto de tomada de conta. Antes rodava
// com `verify_jwt = false` (aberta a qualquer um na internet) e sem checar admin.
// Agora exige JWT válido de um admin da plataforma.
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

    // Try to find existing user
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
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || email.split("@")[0] },
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    const farFuture = "2099-12-31T00:00:00Z";
    const { data: updatedProfiles, error: updateError } = await admin.from("profiles").update({
      subscription_type: "lifetime",
      subscription_expires_at: farFuture,
      trial_ends_at: farFuture,
      is_blocked: false,
    }).eq("id", userId).select("id");
    if (updateError) throw updateError;
    if (!updatedProfiles?.length) throw new Error("Perfil do usuário não foi encontrado para ativação.");

    return new Response(JSON.stringify({ ok: true, user_id: userId, existing: !!existing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
