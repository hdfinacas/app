import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { trustedCheckoutOrigin } from "./trusted_origin.ts";

Deno.test("aceita somente origem de checkout permitida", () => {
  assertEquals(
    trustedCheckoutOrigin("https://checkout.exemplo.com/path", "https://hdfinanceira.sbs", "https://checkout.exemplo.com"),
    "https://checkout.exemplo.com",
  );
});

Deno.test("origem arbitrária volta ao domínio oficial", () => {
  assertEquals(
    trustedCheckoutOrigin("https://phishing.example", "https://hdfinanceira.sbs", ""),
    "https://hdfinanceira.sbs",
  );
});

Deno.test("rejeita protocolos executáveis e credenciais na URL", () => {
  assertEquals(trustedCheckoutOrigin("javascript:alert(1)", undefined, ""), "https://hdfinanceira.sbs");
  assertEquals(trustedCheckoutOrigin("https://hdfinanceira.sbs@evil.example", undefined, ""), "https://hdfinanceira.sbs");
});
