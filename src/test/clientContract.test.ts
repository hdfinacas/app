import { describe, expect, it } from "vitest";
import { sanitizeClientContractText } from "@/lib/clientContract";

describe("clientContract", () => {
  it("remove lucro interno e marcadores operacionais do texto entregue ao cliente", () => {
    const result = sanitizeClientContractText([
      "Capital: R$ 1.000,00",
      "Lucro previsto: R$ 300,00",
      "Observação [cash_disbursed:1000.00] pública",
      "Total a pagar: R$ 1.300,00",
    ].join("\n"));
    expect(result).not.toMatch(/lucro previsto|cash_disbursed/i);
    expect(result).toContain("Capital: R$ 1.000,00");
    expect(result).toContain("Total a pagar: R$ 1.300,00");
  });
});
