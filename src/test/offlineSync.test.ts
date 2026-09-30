import { afterEach, describe, expect, it } from "vitest";
import { formatSyncAge, loadLastSuccessfulSync, saveLastSuccessfulSync } from "@/lib/offlineSync";

describe("offlineSync", () => {
  afterEach(() => localStorage.clear());

  it("persiste o horário da última sincronização válida", () => {
    saveLastSuccessfulSync(1_700_000_000_000);
    expect(loadLastSuccessfulSync()).toBe(1_700_000_000_000);
  });

  it("formata a idade dos dados para leitura rápida", () => {
    const now = 1_700_000_000_000;
    expect(formatSyncAge(null, now)).toBe("dados ainda não sincronizados");
    expect(formatSyncAge(now - 30_000, now)).toBe("sincronizado agora");
    expect(formatSyncAge(now - 15 * 60_000, now)).toBe("sincronizado há 15 min");
    expect(formatSyncAge(now - 3 * 60 * 60_000, now)).toBe("sincronizado há 3 h");
    expect(formatSyncAge(now - 2 * 24 * 60 * 60_000, now)).toBe("sincronizado há 2 dias");
  });
});
