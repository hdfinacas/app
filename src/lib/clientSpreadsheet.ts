import { isOverdue } from "@/lib/dateUtils";

export const buildClientSpreadsheetRows = (
  clients: any[],
  contracts: any[],
  installments: any[],
) => clients.map((client) => {
  const clientContracts = contracts.filter((contract) => contract.client_id === client.id);
  const clientInstallments = installments.filter((installment) => installment.client_id === client.id);
  const countedInstallments = clientInstallments.filter((installment) => installment.status !== "cancelled");
  const paid = countedInstallments.filter((installment) => installment.status === "paid");
  const overdue = countedInstallments.filter(
    (installment) => installment.status !== "paid" && isOverdue(installment.due_date),
  );

  return {
    ...client,
    totalCapital: clientContracts.reduce((sum, contract) => sum + Number(contract.capital || 0), 0),
    totalAmount: clientContracts.reduce((sum, contract) => sum + Number(contract.total_amount || 0), 0),
    totalPaid: paid.reduce((sum, installment) => sum + Number(installment.paid_amount ?? installment.amount ?? 0), 0),
    paidCount: paid.length,
    overdueCount: overdue.length,
    totalInstallments: countedInstallments.length,
    contractCount: clientContracts.length,
  };
});

