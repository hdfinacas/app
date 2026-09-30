/**
 * Ponte para o renderizador de mensagens.
 *
 * A implementação mora em `supabase/functions/_shared/messageTemplate.ts` e é
 * compartilhada de propósito: o bot (Deno) e as telas (navegador) precisam
 * substituir as MESMAS variáveis. Já tivemos três implementações divergentes, e
 * o resultado foi cliente recebendo "[Nome]" e "[Valor]" no WhatsApp.
 *
 * Não copie a lógica para cá — importe.
 */
export {
  renderTemplate,
  renderMessage,
  VARIAVEIS_SUPORTADAS,
  type TemplateVars,
  type RenderResult,
} from "../../supabase/functions/_shared/messageTemplate";
