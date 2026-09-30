import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCallerUser } from "../_shared/guard.ts";
import { consume } from "../_shared/rate_limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // SEGURANÇA (A2): exige usuário autenticado. Sem isso, qualquer um consultava
    // CPF/CNPJ na internet gastando os créditos pagos da APIBrasil do dono e
    // colhendo PII de terceiros em massa.
    const user = await getCallerUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rate = await consume({ key: `consulta-dados:${user.id}`, capacity: 10, refillPerSec: 1 / 60 });
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Muitas consultas. Aguarde um minuto e tente novamente." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      });
    }

    const body = await req.json().catch(() => null);
    const tipo = body?.tipo;
    const documento = body?.documento;

    if ((tipo !== "cpf" && tipo !== "cnpj") || typeof documento !== "string") {
      return new Response(JSON.stringify({ error: "tipo e documento são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanDoc = documento.replace(/\D/g, "").slice(0, 14);
    if ((tipo === "cpf" && !validateCPF(cleanDoc)) || (tipo === "cnpj" && !validateCNPJ(cleanDoc))) {
      return new Response(JSON.stringify({ error: `${String(tipo).toUpperCase()} inválido` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use BrasilAPI (free, no auth required) for CNPJ
    if (tipo === "cnpj") {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`, {
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || "CNPJ não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        tipo: "cnpj",
        documento: cleanDoc,
        dados: {
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          cnpj: data.cnpj,
          situacao_cadastral: data.descricao_situacao_cadastral,
          data_situacao_cadastral: data.data_situacao_cadastral,
          data_inicio_atividade: data.data_inicio_atividade,
          cnae_fiscal: data.cnae_fiscal,
          cnae_descricao: data.cnae_fiscal_descricao,
          natureza_juridica: data.natureza_juridica,
          logradouro: data.logradouro,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          municipio: data.municipio,
          uf: data.uf,
          cep: data.cep,
          telefone: data.ddd_telefone_1,
          email: data.email,
          capital_social: data.capital_social,
          porte: data.porte,
          socios: (data.qsa || []).map((s: any) => ({
            nome: s.nome_socio,
            qualificacao: s.qualificacao_socio,
            cpf_cnpj: s.cnpj_cpf_do_socio,
          })),
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For CPF, use APIBrasil (requires token)
    if (tipo === "cpf") {
      const bearerToken = Deno.env.get("APIBRASIL_BEARER_TOKEN");
      const deviceToken = Deno.env.get("APIBRASIL_DEVICE_TOKEN");

      if (!bearerToken || !deviceToken) {
        // Fallback: basic CPF validation without external API
        const isValid = cleanDoc.length === 11 && validateCPF(cleanDoc);
        return new Response(JSON.stringify({
          tipo: "cpf",
          documento: cleanDoc,
          dados: {
            cpf: formatCPF(cleanDoc),
            valido: isValid,
            mensagem: isValid
              ? "CPF válido. Configure as credenciais da API Brasil para consultas completas."
              : "CPF inválido.",
          },
          api_configurada: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call APIBrasil CPF endpoint
      const res = await fetch("https://gateway.apibrasil.io/api/v2/cpf/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bearerToken}`,
          "DeviceToken": deviceToken,
        },
        body: JSON.stringify({ cpf: cleanDoc }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        return new Response(JSON.stringify({
          tipo: "cpf",
          documento: cleanDoc,
          dados: {
            cpf: formatCPF(cleanDoc),
            valido: validateCPF(cleanDoc),
            mensagem: data.message || data.error || "Erro na consulta CPF",
          },
          api_configurada: true,
        }), {
          status: res.ok ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        tipo: "cpf",
        documento: cleanDoc,
        dados: data.response || data,
        api_configurada: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Tipo inválido. Use 'cpf' ou 'cnpj'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[consulta-dados] falha na consulta", error instanceof Error ? error.message : String(error));
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return new Response(JSON.stringify({ error: timedOut ? "O serviço de consulta demorou para responder. Tente novamente." : "Não foi possível concluir a consulta." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(cpf[10]);
}

function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const digit = (weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12])
    && digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
}
