// deno test supabase/functions/_shared/agent_core_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizePhoneBR, samePhoneBR, extractCPF } from "./agent_core.ts";

Deno.test("normalizePhoneBR: celular com 55 + DDD + 9 dígitos", () => {
  const r = normalizePhoneBR("+55 11 95192-5144");
  assertEquals(r.e164, "5511951925144");
  assertEquals(r.ddd, "11");
  assertEquals(r.local8, "51925144");
});

Deno.test("normalizePhoneBR: sem código do país", () => {
  const r = normalizePhoneBR("(11) 95192-5144");
  assertEquals(r.e164, "5511951925144");
});

Deno.test("normalizePhoneBR: celular sem o 9 (formato antigo)", () => {
  // Sistema deve reconstruir com o 9 na frente
  const r = normalizePhoneBR("11 5192-5144");
  assertEquals(r.e164, "5511951925144");
});

Deno.test("samePhoneBR: variações do mesmo número casam", () => {
  const a = "+55 11 95192-5144";
  const b = "11951925144";
  const c = "5511951925144";
  const d = "1151925144"; // sem o 9
  assertEquals(samePhoneBR(a, b), true);
  assertEquals(samePhoneBR(a, c), true);
  assertEquals(samePhoneBR(a, d), true);
});

Deno.test("samePhoneBR: DDDs diferentes NÃO casam mesmo com 8 finais iguais", () => {
  // Bug antigo: endsWith(tail8) casava clientes de DDD diferente
  const a = "5511951925144"; // DDD 11
  const b = "5521951925144"; // DDD 21
  assertEquals(samePhoneBR(a, b), false);
});

Deno.test("samePhoneBR: números diferentes não casam", () => {
  assertEquals(samePhoneBR("11951925144", "11976813692"), false);
});

Deno.test("extractCPF: encontra CPF em texto livre", () => {
  assertEquals(extractCPF("meu cpf é 123.456.789-00 obrigado"), "12345678900");
  assertEquals(extractCPF("cpf 12345678900"), "12345678900");
  assertEquals(extractCPF("nada aqui"), null);
});
