import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { trustedCheckoutOrigin } from "./trusted_origin.ts";

Deno.test("aceita somente origem de checkout permitida", () => {
  assertEquals(
    trustedCheckoutOrigin("https://checkout.exemplo.com/path", "https://credmaisapp.com.br", "https://checkout.exemplo.com"),
    "https://checkout.exemplo.com",
  );
});

Deno.test("origem arbitrária volta ao domínio oficial", () => {
  assertEquals(
    trustedCheckoutOrigin("https://phishing.example", "https://credmaisapp.com.br", ""),
    "https://credmaisapp.com.br",
  );
});

Deno.test("rejeita protocolos executáveis e credenciais na URL", () => {
  assertEquals(trustedCheckoutOrigin("javascript:alert(1)", undefined, ""), "https://credmaisapp.com.br");
  assertEquals(trustedCheckoutOrigin("https://credmaisapp.com.br@evil.example", undefined, ""), "https://credmaisapp.com.br");
});
