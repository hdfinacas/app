import { describe, expect, it } from "vitest";
import { parseFinancialAmount, parseFinancialDate, parseFinancialDelta } from "@/lib/financialEntry";

describe("financialEntry", () => {
  it.each([
    ["1250.50", 1250.5],
    ["1.250,50", 1250.5],
    ["R$ 10,75", 10.75],
    [25, 25],
  ])("normaliza valor financeiro %s", (input, expected) => {
    expect(parseFinancialAmount(input)).toBe(expected);
  });

  it.each(["", "0", "-1", "abc", Number.NaN])("rejeita valor inválido %s", (input) => {
    expect(parseFinancialAmount(input)).toBeNull();
  });

  it("só converte datas válidas sem trocar o dia informado", () => {
    expect(parseFinancialDate("")).toBeNull();
    expect(parseFinancialDate("data inválida")).toBeNull();
    expect(parseFinancialDate("2026-08-23")).toContain("2026-08-23");
  });

  it("normaliza ajustes positivos e negativos", () => {
    expect(parseFinancialDelta("1.250,50")).toBe(1250.5);
    expect(parseFinancialDelta("-250,75")).toBe(-250.75);
    expect(parseFinancialDelta("0")).toBeNull();
  });
});
