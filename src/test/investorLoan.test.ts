import { describe, expect, it } from "vitest";
import { buildInvestorLoanUpdate, validateInvestorLoanTerms } from "@/lib/investorLoan";

describe("investor loan integrity", () => {
  it("impede total menor que capital ou pagamentos já registrados", () => {
    expect(validateInvestorLoanTerms({ principal: 1000, interestRate: 10, totalDue: 900, paidAmount: 0 })).toMatch(/capital/i);
    expect(validateInvestorLoanTerms({ principal: 1000, interestRate: 10, totalDue: 1100, paidAmount: 1200 })).toMatch(/estorne/i);
  });

  it("impede taxa negativa e aceita termos consistentes", () => {
    expect(validateInvestorLoanTerms({ principal: 1000, interestRate: -1, totalDue: 1000 })).toMatch(/negativa/i);
    expect(validateInvestorLoanTerms({ principal: 1000, interestRate: 10, totalDue: 1100, paidAmount: 300 })).toBeNull();
  });

  it("edição nunca escreve saldo pago, status ou data de quitação", () => {
    const update = buildInvestorLoanUpdate({
      principal: 1000,
      interestRate: 10,
      totalDue: 1100,
      dueDate: "2026-09-30",
      frequency: "bullet",
      notes: "teste",
    });
    expect(update).not.toHaveProperty("paid_amount");
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("paid_at");
  });
});
