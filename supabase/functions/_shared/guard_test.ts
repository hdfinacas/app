import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkSharedSecret, timingSafeEqual } from "./guard.ts";

Deno.test("timingSafeEqual compara conteúdo e tamanho", () => {
  assertEquals(timingSafeEqual("segredo", "segredo"), true);
  assertEquals(timingSafeEqual("segredo", "invalido"), false);
  assertEquals(timingSafeEqual("a", "aa"), false);
});

Deno.test("checkSharedSecret fecha quando a configuração está ausente", () => {
  const envName = "CREDMAIS_TEST_SHARED_SECRET_MISSING";
  const previous = Deno.env.get(envName);
  Deno.env.delete(envName);
  try {
    const request = new Request("https://example.test/webhook");
    assertEquals(checkSharedSecret(request, envName), false);
  } finally {
    if (previous !== undefined) Deno.env.set(envName, previous);
  }
});

Deno.test("checkSharedSecret aceita apenas o segredo correto", () => {
  const envName = "CREDMAIS_TEST_SHARED_SECRET";
  const previous = Deno.env.get(envName);
  Deno.env.set(envName, "correto");
  try {
    assertEquals(checkSharedSecret(new Request("https://example.test", {
      headers: { "x-webhook-secret": "correto" },
    }), envName, "x-webhook-secret"), true);
    assertEquals(checkSharedSecret(new Request("https://example.test?secret=errado"), envName), false);
  } finally {
    if (previous === undefined) Deno.env.delete(envName);
    else Deno.env.set(envName, previous);
  }
});
