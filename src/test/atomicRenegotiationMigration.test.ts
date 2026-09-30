import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260905120000_atomic_contract_renegotiation.sql"), "utf8");

describe("atomic contract renegotiation migration", () => {
  it("creates the replacement and closes the old schedule in one database operation", () => {
    expect(migration).toContain("renegotiate_contract_atomically");
    expect(migration).toContain("create_client_contract");
    expect(migration).toContain("SET status = 'cancelled'");
    expect(migration).toContain("status = 'renegotiated'");
  });
});
