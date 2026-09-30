export type InvestorLoanTerms = {
  principal: number;
  interestRate: number;
  totalDue: number;
  paidAmount?: number;
};

export function validateInvestorLoanTerms(terms: InvestorLoanTerms): string | null {
  const { principal, interestRate, totalDue, paidAmount = 0 } = terms;
  if (!Number.isFinite(principal) || principal <= 0) return "Capital inválido.";
  if (!Number.isFinite(interestRate) || interestRate < 0) return "A taxa não pode ser negativa.";
  if (!Number.isFinite(totalDue) || totalDue < principal) return "O total não pode ser menor que o capital recebido.";
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return "O valor já pago é inválido.";
  if (totalDue < paidAmount) return "Estorne pagamentos antes de reduzir o total.";
  return null;
}

export function buildInvestorLoanUpdate(input: {
  principal: number;
  interestRate: number;
  totalDue: number;
  dueDate: string;
  frequency: string;
  notes: string;
}) {
  return {
    principal: input.principal,
    interest_rate: input.interestRate,
    total_due: input.totalDue,
    due_date: input.dueDate,
    frequency: input.frequency,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
}
