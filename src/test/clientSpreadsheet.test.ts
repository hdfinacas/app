import { describe, expect, it } from "vitest";
import { buildClientSpreadsheetRows } from "@/lib/clientSpreadsheet";

describe("buildClientSpreadsheetRows", () => {
  it("não conta parcela cancelada no progresso nem no atraso", () => {
    const rows = buildClientSpreadsheetRows(
      [{ id: "client-1", name: "Cliente" }],
      [{ id: "contract-1", client_id: "client-1", capital: 1000, total_amount: 1200 }],
      [
        { client_id: "client-1", status: "paid", amount: 400, paid_amount: 400, due_date: "2020-01-01" },
        { client_id: "client-1", status: "pending", amount: 400, due_date: "2020-02-01" },
        { client_id: "client-1", status: "cancelled", amount: 400, due_date: "2020-03-01" },
      ],
    );

    expect(rows[0]).toMatchObject({
      totalInstallments: 2,
      paidCount: 1,
      overdueCount: 1,
      totalPaid: 400,
    });
  });
});

