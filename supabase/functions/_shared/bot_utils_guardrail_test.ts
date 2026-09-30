import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { assertReplySafe } from "./bot_utils.ts";

const me = { id: "c1", name: "Gustavo Lopes", cpf_cnpj: "111.222.333-44" };
const others = [
  { id: "c2", name: "Marcelo Souza", cpf_cnpj: "555.666.777-88" },
  { id: "c3", name: "Ana Beatriz", cpf_cnpj: "999.888.777-66" },
];

Deno.test("bloqueia vazamento de nome de outro cliente", () => {
  const r = assertReplySafe({
    reply: "Oi Marcelo, sua parcela venceu.",
    currentClient: me,
    otherClientsSample: others,
  });
  assertEquals(r.block, true);
  assertEquals(r.reasons.some((x) => x.startsWith("leak_name:marcelo")), true);
});

Deno.test("não bloqueia quando cita só o próprio cliente", () => {
  const r = assertReplySafe({
    reply: "Oi Gustavo, tudo bem?",
    currentClient: me,
    otherClientsSample: others,
  });
  assertEquals(r.block, false);
});

Deno.test("bloqueia oferta de desconto/negociação", () => {
  const r = assertReplySafe({
    reply: "Posso oferecer 20% de desconto se pagar hoje.",
    currentClient: me,
  });
  assertEquals(r.block, true);
  assertEquals(r.reasons.includes("negotiation_offered"), true);
});

Deno.test("bloqueia CPF de outro cliente no texto", () => {
  const r = assertReplySafe({
    reply: "Confirmando CPF 555.666.777-88 para regularizar.",
    currentClient: me,
    otherClientsSample: others,
  });
  assertEquals(r.block, true);
  assertEquals(r.reasons.some((x) => x.startsWith("leak_cpf:")), true);
});

Deno.test("bloqueia valor antes de identidade confirmada", () => {
  const r = assertReplySafe({
    reply: "Sua parcela é de R$ 350,00.",
    currentClient: me,
    identityConfirmed: false,
    hasMoney: true,
  });
  assertEquals(r.block, true);
  assertEquals(r.reasons.includes("value_before_identity"), true);
});

Deno.test("softHit para data desconhecida", () => {
  const r = assertReplySafe({
    reply: "Sua parcela vence dia 15/07.",
    currentClient: me,
    allowedDueDates: ["2026-08-10", "2026-09-10"],
  });
  assertEquals(r.block, false);
  assertEquals(r.softHits.some((x) => x.startsWith("unknown_date")), true);
});

Deno.test("bloqueia valor inventado fora do conjunto permitido", () => {
  const r = assertReplySafe({
    reply: "Sua parcela é de R$ 999,00.",
    currentClient: me,
    identityConfirmed: true,
    hasMoney: true,
    allowedAmounts: [350, 700, 1050],
  });
  assertEquals(r.block, true);
  assertEquals(r.reasons.some((x) => x.startsWith("invented_amount")), true);
});

Deno.test("aceita valor permitido com tolerância de centavos", () => {
  const r = assertReplySafe({
    reply: "Sua parcela é de R$ 350,00 e o total em atraso é R$ 1.050,00.",
    currentClient: me,
    identityConfirmed: true,
    hasMoney: true,
    allowedAmounts: [350, 700, 1050],
  });
  assertEquals(r.block, false);
});
