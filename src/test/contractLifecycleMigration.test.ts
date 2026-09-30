import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260905110000_contract_lifecycle.sql"),
  "utf8",
);

describe("contract lifecycle migration", () => {
  it("keeps a signed contract out of collection until its signature is confirmed", () => {
    expect(migration).toContain("pending_signature");
    expect(migration).toContain("activate_signed_contract");
    expect(migration).toContain("NEW.status := 'active'");
  });

  it("records contract stage changes in an owner-scoped audit trail", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.contract_events");
    expect(migration).toContain("contract_events_owner_read");
    expect(migration).toContain("audit_contract_lifecycle");
  });
});
