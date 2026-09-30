import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823230000_harden_client_error_ingestion.sql"),
  "utf8",
);

describe("migração de proteção do coletor de erros", () => {
  it("não altera nem remove registros existentes", () => {
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("impede que o visitante falsifique a identidade do erro", () => {
    expect(sql).toContain("auth.uid() IS NULL AND user_id IS NULL");
    expect(sql).toContain("auth.uid() IS NOT NULL AND user_id = auth.uid()");
  });

  it("limita todos os campos livres que chegam do navegador", () => {
    expect(sql).toMatch(/char_length\(rota\) <= 500/i);
    expect(sql).toMatch(/char_length\(navegador\) <= 400/i);
    expect(sql).toMatch(/octet_length\(contexto::text\) <= 8192/i);
  });
});
