import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceEntitlement, entitlementResponse } from "../_shared/entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const entitlement = await enforceEntitlement(user.id, "transcribe-audio", { completeOnly: true, capacity: 30 });
    if (!entitlement.ok) return entitlementResponse(entitlement, corsHeaders);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de transcrição configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const useOpenAI = !!OPENAI_API_KEY;

    const inbound = await req.formData();
    const file = inbound.get("file");
    // `File` não existe como tipo no Deno aqui, e o `instanceof File` derrubava o
    // type check do arquivo inteiro. Um `File` é um `Blob`, então testar Blob
    // cobre os dois casos e vale em tempo de execução do mesmo jeito.
    if (!(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "arquivo ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const blob = file as Blob;
    if (blob.size < 1024) {
      return new Response(JSON.stringify({ error: "Áudio muito curto" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (blob.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Áudio maior que 20MB" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const filename = (file as File).name || "recording.wav";
    const upstream = new FormData();
    upstream.append("model", useOpenAI ? "gpt-4o-transcribe" : "openai/gpt-4o-transcribe");
    upstream.append("file", blob, filename);
    upstream.append("language", "pt");

    const resp = await fetch(
      useOpenAI ? "https://api.openai.com/v1/audio/transcriptions" : "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY}` },
        body: upstream,
      },
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("[transcribe]", resp.status, detail);
      return new Response(JSON.stringify({ error: "Falha na transcrição", status: resp.status, detail }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await resp.json();
    return new Response(JSON.stringify({ text: json.text || "", usage: json.usage || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[transcribe] fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
