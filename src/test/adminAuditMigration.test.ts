import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823233000_admin_audit_visibility.sql"),
  "utf8",
);

describe("visibilidade administrativa da auditoria", () => {
  it("autoriza leitura somente pela fonte de verdade administrativa", () => {
    expect(sql).toMatch(/FOR SELECT TO authenticated/i);
    expect(sql).toContain("public.is_admin(auth.uid())");
  });

  it("não altera nem remove logs existentes", () => {
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
