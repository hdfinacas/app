import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260911010000_atomic_contract_mutations.sql"),
  "utf8",
);

describe("atomic contract mutations migration", () => {
  it("locks and validates contract edits before replacing pending installments", () => {
    expect(migration).toContain("update_contract_atomically");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("paid_installment_would_be_removed");
    expect(migration).toContain("installment_count_mismatch");
  });

  it("deletes related financial records inside the same RPC", () => {
    expect(migration).toContain("delete_contract_atomically");
    expect(migration).toContain("DELETE FROM public.transactions");
    expect(migration).toContain("DELETE FROM public.contract_installments");
    expect(migration).toContain("GRANT EXECUTE");
  });
});
