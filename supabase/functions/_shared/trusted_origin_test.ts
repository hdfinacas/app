import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { trustedCheckoutOrigin } from "./trusted_origin.ts";

Deno.test("aceita somente origem de checkout permitida", () => {
  assertEquals(
    trustedCheckoutOrigin("https://checkout.exemplo.com/path", "https://dhfinanceira.sbs", "https://checkout.exemplo.com"),
    "https://checkout.exemplo.com",
  );
});

Deno.test("origem arbitrária volta ao domínio oficial", () => {
  assertEquals(
    trustedCheckoutOrigin("https://phishing.example", "https://dhfinanceira.sbs", ""),
    "https://dhfinanceira.sbs",
  );
});

Deno.test("rejeita protocolos executáveis e credenciais na URL", () => {
  assertEquals(trustedCheckoutOrigin("javascript:alert(1)", undefined, ""), "https://dhfinanceira.sbs");
  assertEquals(trustedCheckoutOrigin("https://dhfinanceira.sbs@evil.example", undefined, ""), "https://dhfinanceira.sbs");
});
