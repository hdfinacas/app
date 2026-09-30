import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppModeProvider, useAppMode } from "@/contexts/AppModeContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isPlatformAdmin: true, loading: false }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={["/admin"]}>
    <AppModeProvider>{children}</AppModeProvider>
  </MemoryRouter>
);

describe("AppModeProvider", () => {
  beforeEach(() => localStorage.clear());

  it("permite ao dono sair do painel e entrar na própria operação", async () => {
    const { result } = renderHook(
      () => ({ appMode: useAppMode(), navigate: useNavigate() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.appMode.mode).toBe("platform"));

    act(() => result.current.appMode.setMode("operation"));

    await waitFor(() => expect(result.current.appMode.mode).toBe("operation"));
    expect(localStorage.getItem("app-mode")).toBe("operation");
  });

  it("volta ao modo plataforma quando navega novamente para uma rota administrativa", async () => {
    const { result } = renderHook(
      () => ({ appMode: useAppMode(), navigate: useNavigate() }),
      { wrapper },
    );

    act(() => {
      result.current.appMode.setMode("operation");
      result.current.navigate("/dashboard");
    });
    await waitFor(() => expect(result.current.appMode.mode).toBe("operation"));

    act(() => result.current.navigate("/admin"));
    await waitFor(() => expect(result.current.appMode.mode).toBe("platform"));
  });
});
