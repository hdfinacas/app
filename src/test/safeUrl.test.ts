import { describe, expect, it } from "vitest";
import { toSafeHttpUrl } from "@/lib/safeUrl";

describe("toSafeHttpUrl", () => {
  it("aceita checkout HTTPS e caminhos internos", () => {
    expect(toSafeHttpUrl("https://www.mercadopago.com.br/checkout")?.protocol).toBe("https:");
    expect(toSafeHttpUrl("/checkout", "https://dhfinanceira.sbs")?.href).toBe("https://dhfinanceira.sbs/checkout");
  });

  it("permite HTTP somente no desenvolvimento local", () => {
    expect(toSafeHttpUrl("http://localhost:8080/checkout")?.hostname).toBe("localhost");
    expect(toSafeHttpUrl("http://dhfinanceira.sbs/checkout")).toBeNull();
  });

  it("rejeita esquemas ativos, malformados e valores vazios", () => {
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(toSafeHttpUrl(" ")).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
  });
});
