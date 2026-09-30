import { describe, expect, it, vi } from "vitest";
import { buildPendingSchedule, createContractAtomically } from "@/lib/contractPersistence";

const input = {
  clientId: "client-1",
  contract: { capital: 1000, num_installments: 2 },
  installments: [
    { installment_number: 1, amount: 600, due_date: "2026-09-01T12:00:00.000Z" },
    { installment_number: 2, amount: 600, due_date: "2026-10-01T12:00:00.000Z" },
  ],
};

describe("createContractAtomically", () => {
  it("envia contrato e cronograma por uma única RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { client_id: "client-1", contract_id: "contract-1", installment_count: 2 },
      error: null,
    });

    await expect(createContractAtomically({ rpc }, input)).resolves.toMatchObject({ contract_id: "contract-1" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_client_contract", expect.objectContaining({
      _client_id: "client-1",
      _installments: input.installments,
    }));
  });

  it("propaga falha do banco sem fingir sucesso", async () => {
    const failure = { message: "installment_count_mismatch" };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: failure });
    await expect(createContractAtomically({ rpc }, input)).rejects.toBe(failure);
  });

  it("rejeita confirmação incompleta do banco", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { client_id: "client-1", contract_id: "contract-1", installment_count: 1 },
      error: null,
    });
    await expect(createContractAtomically({ rpc }, input)).rejects.toThrow(/criação completa/i);
  });
});

describe("buildPendingSchedule", () => {
  it("preserva números pagos fora de ordem e recria apenas os ausentes", () => {
    const rows = buildPendingSchedule({
      dueDates: ["d1", "d2", "d3", "d4"],
      paidInstallmentNumbers: [1, 3],
      amount: 250,
      userId: "user-1",
      contractId: "contract-1",
      clientId: "client-1",
    });

    expect(rows.map((row) => row.installment_number)).toEqual([2, 4]);
    expect(rows.map((row) => row.due_date)).toEqual(["d2", "d4"]);
  });

  it("não recria parcela quando todo o cronograma já foi pago", () => {
    expect(buildPendingSchedule({
      dueDates: ["d1", "d2"],
      paidInstallmentNumbers: [1, 2],
      amount: 100,
      userId: "user-1",
      contractId: "contract-1",
      clientId: "client-1",
    })).toEqual([]);
  });
});
