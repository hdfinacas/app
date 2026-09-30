
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  senderName?: string;
}

export async function sendEmail(payload: EmailPayload) {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY not set");
    return { error: "BREVO_API_KEY not set" };
  }

  const { senderName, ...emailPayload } = payload;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: senderName || Deno.env.get("EMAIL_SENDER_NAME") || "DH Financeira",
        email: Deno.env.get("BREVO_SENDER_EMAIL") || "noreply@hdfinanceira.sbs",
      },
      ...emailPayload,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("Brevo API Error:", result);
    return { error: result };
  }

  return { success: true, result };
}

export const templates = {
  welcome: (name: string) => ({
    subject: "Seu acesso à DH Financeira está pronto",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #D8E8F7; border-radius: 12px; color: #042A40;">
        <h2>Olá, ${name}!</h2>
        <p>Sua conta foi criada e liberada pelo administrador da DH Financeira.</p>
        <p>Use o botão abaixo para acessar a plataforma.</p>
        <p style="margin: 28px 0;"><a href="https://hdfinanceira.sbs/login" style="background: #006BCC; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Acessar a plataforma</a></p>
      </div>
    `
  }),
  trialExpiring: (name: string, daysLeft: number) => ({
    subject: `Seu prazo de acesso termina em ${daysLeft} dias`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #D8E8F7; border-radius: 12px; color: #042A40;">
        <h2>Olá, ${name}!</h2>
        <p>Seu prazo temporário de acesso à DH Financeira termina em <strong>${daysLeft} dias</strong>.</p>
        <p>Fale com o administrador da sua conta para combinar a continuidade do acesso.</p>
        <p style="margin: 28px 0;"><a href="https://hdfinanceira.sbs/login" style="background: #006BCC; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Acessar a plataforma</a></p>
      </div>
    `
  }),  monthlyReport: (name: string, month: string, summary: any) => ({
    subject: `📊 Seu Relatório de Performance - ${month}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9fafb;">
        <div style="text-align: center; padding-bottom: 20px;">
          <h1 style="color: #1e293b; margin: 0;">Relatório Mensal BI</h1>
          <p style="color: #64748b; font-size: 14px;">DH Financeira - Inteligência de Negócios</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h2 style="color: #334155; font-size: 18px; margin-top: 0;">Resumo de ${month}</h2>
          <p style="color: #475569;">Olá, ${name}. Aqui estão os números do seu negócio no último mês:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Lucro Total</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #10b981;">R$ ${summary.profit}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Gastos Total</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #ef4444;">R$ ${summary.expenses}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; border-radius: 4px 0 0 4px; font-weight: bold; color: #1e293b;">Saldo Líquido</td>
              <td style="padding: 10px; border-radius: 0 4px 4px 0; text-align: right; font-weight: bold; color: #3b82f6;">R$ ${summary.balance}</td>
            </tr>
          </table>

          <div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 13px; color: #1e40af;"><strong>Insight IA:</strong> ${summary.insight}</p>
          </div>
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="https://hdfinanceira.sbs/relatorios" style="background: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Ver Detalhes no Sistema</a>
        </div>
        
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Este é um relatório automático gerado pelo seu assistente de BI do DH Financeira.</p>
      </div>
    `
  })
};
