import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOfflineSession, loadOfflineSession, saveOfflineSession } from "@/lib/offlineSession";

describe("sessão offline", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restaura perfil e permissão dentro da validade", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    saveOfflineSession("user-1", { id: "user-1", name: "Teste" }, true);

    expect(loadOfflineSession("user-1", 2_000)).toEqual({
      profile: { id: "user-1", name: "Teste" },
      isPlatformAdmin: true,
      savedAt: 1_000,
    });
  });

  it("não restaura cache vencido ou de outro usuário", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    saveOfflineSession("user-1", { id: "user-1" }, false);

    expect(loadOfflineSession("user-2", 2_000)).toBeNull();
    expect(loadOfflineSession("user-1", 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("remove os dados locais no logout", () => {
    saveOfflineSession("user-1", { id: "user-1" }, false);
    clearOfflineSession("user-1");
    expect(loadOfflineSession("user-1")).toBeNull();
  });
});
