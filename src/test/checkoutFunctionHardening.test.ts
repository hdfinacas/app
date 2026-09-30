import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(
  resolve(process.cwd(), `supabase/functions/${name}/index.ts`),
  "utf8",
);

describe("funções públicas de checkout", () => {
  it("não devolvem o corpo bruto do provedor ao navegador", () => {
    for (const name of ["mercadopago-create-preference", "mercadopago-process-payment"]) {
      const code = source(name);
      expect(code).not.toMatch(/\bdetails\s*:\s*data\b/);
      expect(code).not.toMatch(/error\s*:\s*String\(e/);
    }
  });

  it("limitam chamadas externas e rejeitam métodos inesperados", () => {
    const preference = source("mercadopago-create-preference");
    const payment = source("mercadopago-process-payment");
    expect(preference).toContain('req.method !== "POST"');
    expect(preference).toContain("AbortSignal.timeout");
    expect(payment).toContain("AbortSignal.timeout");
  });
});
