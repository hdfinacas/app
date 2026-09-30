import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayModal from "@/components/cobrancas/PayModal";

describe("PayModal — desconto nos encargos", () => {
  it("desconta somente multa/juros e envia o valor final correto", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PayModal
        inst={{ client_name: "Cliente Teste", installment_number: 1, due_date: "2026-08-01" }}
        fee={{ daysLate: 10, base: 100, multaPct: 0, jurosPct: 4, multa: 0, juros: 50, total: 50, withFees: 150 }}
        alreadyPaid={0}
        remaining={150}
        daysLate={10}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dar desconto" }));
    expect(screen.getByText("− R$ 25,00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar R$ 125,00" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(125, 25, { mode: "payment" }));
  });

  it("remove todos os encargos sem reduzir o principal", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PayModal
        inst={{ client_name: "Cliente Teste", installment_number: 1, due_date: "2026-08-01" }}
        fee={{ daysLate: 10, base: 100, multaPct: 0, jurosPct: 4, multa: 0, juros: 50, total: 50, withFees: 150 }}
        alreadyPaid={0}
        remaining={150}
        daysLate={10}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover multa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar R$ 100,00" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(100, 50, { mode: "payment" }));
  });
});
