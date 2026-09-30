import { describe, expect, it } from "vitest";
import { hasProfileEntitlement } from "@/lib/entitlement";

const NOW = new Date("2026-08-23T12:00:00Z").getTime();

describe("hasProfileEntitlement", () => {
  it("libera acesso vitalício mesmo sem data de vencimento", () => {
    expect(hasProfileEntitlement({ subscriptionType: "lifetime" }, NOW)).toBe(true);
  });

  it("libera teste ou assinatura vigente", () => {
    expect(hasProfileEntitlement({ trialEndsAt: "2026-08-24T00:00:00Z" }, NOW)).toBe(true);
    expect(hasProfileEntitlement({ subscriptionExpiresAt: "2026-09-23T00:00:00Z" }, NOW)).toBe(true);
  });

  it("recusa datas vencidas, inválidas ou ausentes", () => {
    expect(hasProfileEntitlement({ subscriptionExpiresAt: "2026-08-22T00:00:00Z" }, NOW)).toBe(false);
    expect(hasProfileEntitlement({ trialEndsAt: "data-inválida" }, NOW)).toBe(false);
    expect(hasProfileEntitlement({}, NOW)).toBe(false);
  });
});
