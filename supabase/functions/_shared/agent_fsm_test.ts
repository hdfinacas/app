import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { canTransition, transition, isStale, normalizeSnapshot } from "./agent_fsm.ts";

Deno.test("transição básica UNKNOWN -> IDENTIFYING", () => {
  const g = canTransition("UNKNOWN", "IDENTIFYING");
  assertEquals(g.ok, true);
});

Deno.test("bloqueia INTENT_PAGAR sem overdue", () => {
  const g = canTransition("CONFIRMED", "INTENT_PAGAR", { overdue_total: 0 });
  assertEquals(g.ok, false);
  assertEquals(g.reason, "intent_pagar_requires_overdue");
});

Deno.test("permite INTENT_PAGAR com overdue > 0", () => {
  const g = canTransition("CONFIRMED", "INTENT_PAGAR", { overdue_total: 350, client_id: "c1" });
  assertEquals(g.ok, true);
});

Deno.test("bloqueia CONFIRMED sem client_id", () => {
  const g = canTransition("IDENTIFYING", "CONFIRMED", {});
  assertEquals(g.ok, false);
});

Deno.test("transition retorna snapshot novo válido", () => {
  const cur = normalizeSnapshot({ agent_state: "IDENTIFYING", agent_state_data: {}, agent_state_updated_at: null });
  const { next, error } = transition(cur, "CONFIRMED", { client_id: "abc" });
  assertEquals(error, undefined);
  assertEquals(next.state, "CONFIRMED");
  assertEquals(next.data.client_id, "abc");
});

Deno.test("transition retorna erro para pulo inválido", () => {
  const cur = normalizeSnapshot({ agent_state: "UNKNOWN", agent_state_data: {}, agent_state_updated_at: null });
  const { next, error } = transition(cur, "INTENT_PAGAR");
  assertEquals(!!error, true);
  assertEquals(next.state, "UNKNOWN");
});

Deno.test("isStale respeita timeout do estado", () => {
  const old = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  assertEquals(isStale("IDENTIFYING", old), true); // timeout 15min
  const fresh = new Date().toISOString();
  assertEquals(isStale("IDENTIFYING", fresh), false);
});
