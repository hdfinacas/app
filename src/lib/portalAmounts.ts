import { outstandingDue, type LateFeeInput } from "@/lib/lateFee";

/** Valor exibido/cobrado no portal, sem duplicar encargos nem ignorar parciais. */
export function portalInstallmentAmount(installment: LateFeeInput, now?: Date): number {
  if (installment.status === "paid") {
    const paid = Number(installment.paid_amount);
    return Number.isFinite(paid) && paid > 0 ? paid : Number(installment.amount || 0);
  }
  return outstandingDue(installment, now);
}

/** Total acumulado que os RPCs de baixa recebem após um novo pagamento. */
export function accumulatedPaymentTotal(installment: LateFeeInput, receivedNow: number): number {
  return Math.round((Number(installment.paid_amount || 0) + Number(receivedNow || 0)) * 100) / 100;
}
