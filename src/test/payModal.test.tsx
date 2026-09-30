import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayModal from "@/components/cobrancas/PayModal";

const fee = {
  daysLate: 3,
  base: 100,
  multaPct: 0,
  jurosPct: 4,
  multa: 0,
  juros: 12.49,
  total: 12.49,
  withFees: 112.49,
};

describe("PayModal — desconto dos encargos", () => {
  it("envia o valor original e ativa o perdão de encargos", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PayModal
        inst={{ client_name: "Cliente", installment_number: 1, due_date: "2026-08-16", contracts: {} }}
        fee={fee}
        alreadyPaid={0}
        remaining={112.49}
        daysLate={3}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover multa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar R$ 100,00" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(100, 12.49, { mode: "payment" }));
  });

  it("bloqueia novo clique enquanto a gravação está pendente", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const onConfirm = vi.fn(() => pending);
    render(
      <PayModal
        inst={{ client_name: "Cliente", installment_number: 1, due_date: "2026-08-16", contracts: {} }}
        fee={fee}
        alreadyPaid={0}
        remaining={112.49}
        daysLate={3}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover multa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar R$ 100,00" }));
    expect(await screen.findByRole("button", { name: /Registrando/ })).toBeDisabled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
});
