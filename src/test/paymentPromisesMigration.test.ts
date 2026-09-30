import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260905100000_payment_promises.sql"),
  "utf8",
);

describe("payment promises migration", () => {
  it("materializa promessas do bot e mantém só uma vigente por cliente", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.payment_promises");
    expect(migration).toContain("idx_payment_promises_one_open_per_client");
    expect(migration).toContain("materialize_payment_promise_from_audit");
  });

  it("cumpre a promessa apenas quando a parcela fica quitada", () => {
    expect(migration).toContain("NEW.status = 'paid'");
    expect(migration).toContain("status = 'fulfilled'");
    expect(migration).toContain("status = 'broken'");
    expect(migration).toContain("user_id = auth.uid()");
  });
});
