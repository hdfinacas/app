import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823210000_forward_contract_disbursement.sql"),
  "utf8",
);

describe("migration prospectiva do razão", () => {
  it("não executa backfill nem altera linhas existentes", () => {
    expect(sql).not.toMatch(/\bDO\s+\$\$/i);
    expect(sql).not.toMatch(/\bUPDATE\s+public\./i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+public\./i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.transactions[\s\S]+?\bSELECT\b/i);
  });

  it("atua apenas depois da criação de um contrato", () => {
    expect(sql).toMatch(/AFTER\s+INSERT\s+ON\s+public\.contracts/i);
    expect(sql).toMatch(/FOR\s+EACH\s+ROW/i);
  });

  it("diferencia capital novo de saldo renegociado e é idempotente", () => {
    expect(sql).toContain("[cash_disbursed:");
    expect(sql).toContain("'loan-disbursement:' || NEW.id::text");
    expect(sql).toMatch(/ON\s+CONFLICT\s+\(user_id,\s*source_key\)[\s\S]+?DO\s+NOTHING/i);
  });
});

