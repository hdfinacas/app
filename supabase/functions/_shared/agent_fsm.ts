// ============================================================================
// Máquina de Estados do Agente (WhatsApp)
// ----------------------------------------------------------------------------
// Estados finitos explícitos que persistem entre turnos em
// `whatsapp_conversations.agent_state` (+ `agent_state_data` para o payload).
//
// Fluxo:
//   UNKNOWN → IDENTIFYING → CONFIRMED → MENU → INTENT_<tipo> → CLOSED
//
// Guardas (checadas por `canTransition`):
//   • Só entra em INTENT_PAGAR se overdue_total > 0 (via data.overdue_total)
//   • Só entra em CONFIRMED depois de IDENTIFYING com client_id definido
//   • Timeouts por estado — se expira, volta para UNKNOWN
// ============================================================================

export type AgentState =
  | "UNKNOWN"
  | "IDENTIFYING"
  | "CONFIRMED"
  | "MENU"
  | "INTENT_PAGAR"
  | "INTENT_COMPROVANTE"
  | "INTENT_CONTESTAR"
  | "INTENT_HUMANO"
  | "INTENT_PROMESSA"
  | "INTENT_SEM_CONDICAO"
  | "CLOSED";

export interface AgentStateData {
  client_id?: string | null;
  overdue_total?: number;
  last_intent?: string | null;
  promise_date?: string | null;
  promise_amount?: number | null;
  human_reason?: string | null;
  entered_at?: string;
  [k: string]: unknown;
}

// Timeout por estado em minutos — depois disso, considera stale e reinicia.
const TIMEOUTS_MIN: Record<AgentState, number> = {
  UNKNOWN: 0,
  IDENTIFYING: 15,
  CONFIRMED: 30,
  MENU: 30,
  INTENT_PAGAR: 60,
  INTENT_COMPROVANTE: 30,
  INTENT_CONTESTAR: 240,
  INTENT_HUMANO: 1440, // 24h aguardando humano
  INTENT_PROMESSA: 43200, // 30 dias (mantém a promessa até vencer)
  INTENT_SEM_CONDICAO: 240,
  CLOSED: 0,
};

const ALLOWED: Record<AgentState, AgentState[]> = {
  UNKNOWN: ["IDENTIFYING", "CLOSED"],
  IDENTIFYING: ["CONFIRMED", "UNKNOWN", "INTENT_HUMANO", "CLOSED"],
  CONFIRMED: ["MENU", "INTENT_PAGAR", "INTENT_HUMANO", "INTENT_CONTESTAR", "INTENT_SEM_CONDICAO", "INTENT_PROMESSA", "CLOSED"],
  MENU: ["INTENT_PAGAR", "INTENT_COMPROVANTE", "INTENT_CONTESTAR", "INTENT_HUMANO", "INTENT_PROMESSA", "INTENT_SEM_CONDICAO", "CONFIRMED", "CLOSED"],
  INTENT_PAGAR: ["CONFIRMED", "MENU", "INTENT_HUMANO", "CLOSED"],
  INTENT_COMPROVANTE: ["CONFIRMED", "MENU", "INTENT_HUMANO", "CLOSED"],
  INTENT_CONTESTAR: ["INTENT_HUMANO", "CLOSED"],
  INTENT_HUMANO: ["CLOSED", "CONFIRMED"],
  INTENT_PROMESSA: ["CONFIRMED", "MENU", "INTENT_PAGAR", "INTENT_HUMANO", "CLOSED"],
  INTENT_SEM_CONDICAO: ["INTENT_HUMANO", "CONFIRMED", "CLOSED"],
  CLOSED: ["UNKNOWN"],
};

export function canTransition(from: AgentState, to: AgentState, data?: AgentStateData): { ok: boolean; reason?: string } {
  const list = ALLOWED[from] || [];
  if (!list.includes(to)) return { ok: false, reason: `transition_not_allowed:${from}->${to}` };
  if (to === "CONFIRMED" && !data?.client_id) return { ok: false, reason: "confirmed_requires_client_id" };
  if (to === "INTENT_PAGAR" && !(Number(data?.overdue_total) > 0)) {
    return { ok: false, reason: "intent_pagar_requires_overdue" };
  }
  return { ok: true };
}

export function isStale(state: AgentState, updatedAtIso: string | null | undefined): boolean {
  if (!state || state === "UNKNOWN" || state === "CLOSED") return false;
  const timeoutMin = TIMEOUTS_MIN[state] ?? 0;
  if (!timeoutMin) return false;
  if (!updatedAtIso) return true;
  const ts = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(ts)) return true;
  return (Date.now() - ts) > timeoutMin * 60 * 1000;
}

export interface FsmSnapshot {
  state: AgentState;
  data: AgentStateData;
  updated_at: string | null;
}

export function normalizeSnapshot(raw: {
  agent_state?: string | null;
  agent_state_data?: unknown;
  agent_state_updated_at?: string | null;
} | null | undefined): FsmSnapshot {
  const state = (raw?.agent_state as AgentState) || "UNKNOWN";
  const data = (raw?.agent_state_data && typeof raw.agent_state_data === "object")
    ? (raw.agent_state_data as AgentStateData)
    : {};
  return { state, data, updated_at: raw?.agent_state_updated_at || null };
}

/**
 * Retorna o próximo snapshot já validado. Se a transição não for permitida,
 * retorna o snapshot atual e um `error` explicando por quê — o caller decide
 * se loga, reinicia ou ignora.
 */
export function transition(
  current: FsmSnapshot,
  to: AgentState,
  patch: Partial<AgentStateData> = {},
): { next: FsmSnapshot; error?: string } {
  const nextData: AgentStateData = { ...current.data, ...patch, entered_at: new Date().toISOString() };
  const guard = canTransition(current.state, to, nextData);
  if (!guard.ok) return { next: current, error: guard.reason };
  return {
    next: { state: to, data: nextData, updated_at: new Date().toISOString() },
  };
}

/**
 * Persiste o snapshot na tabela `whatsapp_conversations`. Falha silenciosa
 * (retorna false) — o webhook nunca deve quebrar por causa do FSM.
 */
export async function saveSnapshot(
  supabase: any,
  conversationId: string,
  snap: FsmSnapshot,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        agent_state: snap.state,
        agent_state_data: snap.data,
        agent_state_updated_at: snap.updated_at ?? new Date().toISOString(),
      })
      .eq("id", conversationId);
    return !error;
  } catch {
    return false;
  }
}
