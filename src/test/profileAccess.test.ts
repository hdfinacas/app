import { describe, expect, it } from "vitest";
import { resolveProfileAccessEnd } from "@/lib/profileAccess";

describe("resolveProfileAccessEnd", () => {
  it("identifica teste quando as duas datas são iguais", () => {
    const date = "2026-08-26T12:00:00Z";
    expect(resolveProfileAccessEnd(date, date)).toEqual({ value: date, source: "trial" });
  });

  it("não exibe uma assinatura expirada no lugar de um teste vigente", () => {
    expect(resolveProfileAccessEnd("2026-08-26T12:00:00Z", "2026-08-20T12:00:00Z")).toEqual({
      value: "2026-08-26T12:00:00Z",
      source: "trial",
    });
  });

  it("usa a assinatura quando ela possui a validade mais longa", () => {
    expect(resolveProfileAccessEnd("2026-08-26T12:00:00Z", "2026-09-23T12:00:00Z")).toEqual({
      value: "2026-09-23T12:00:00Z",
      source: "subscription",
    });
  });
});
