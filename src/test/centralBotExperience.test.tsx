import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CentralBot from "@/pages/CentralBot";

const state = vi.hoisted(() => ({ stats: { data: undefined, isError: false, isLoading: true, refetch: vi.fn() } as any }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "test" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: any) => queryKey[0] === "central-bot-stats" ? state.stats : { data: undefined, isLoading: true } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
afterEach(cleanup);
beforeEach(() => { state.stats = { data: undefined, isError: false, isLoading: true, refetch: vi.fn() }; });
const open = () => render(<MemoryRouter><CentralBot /></MemoryRouter>);

it("não exibe sucesso enquanto carrega", () => {
  open();
  expect(screen.queryByText("100%")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Carregando…");
});
it("distingue ausência de atividade de sucesso", () => {
  state.stats = { ...state.stats, isLoading: false, data: { messages24h: 0, actions24h: 0, successRate: null } };
  open();
  expect(screen.getByRole("status").textContent).toBe("Sem atividade");
});
it("oculta taxa antiga quando atualização falha", () => {
  state.stats = { ...state.stats, isLoading: false, isError: true, data: { successRate: 100 } };
  open();
  expect(screen.queryByText("100%")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar");
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
});
it("exibe a taxa carregada e mantém os nomes das abas acessíveis", () => {
  state.stats = { ...state.stats, isLoading: false, data: { messages24h: 4, actions24h: 4, successRate: 75 } };
  open();
  expect(screen.getByRole("status").textContent).toBe("75%");
  expect(screen.getByRole("tab", { name: "Configurações" })).toBeTruthy();
});
