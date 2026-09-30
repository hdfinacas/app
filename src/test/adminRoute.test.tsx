import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRoute from "@/components/AdminRoute";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isPlatformAdmin: false,
  loading: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const renderRoute = () => render(
  <MemoryRouter initialEntries={["/admin"]}>
    <Routes>
      <Route
        path="/admin"
        element={<AdminRoute><div>Painel administrativo</div></AdminRoute>}
      />
      <Route path="/dashboard" element={<div>Painel do usuário</div>} />
      <Route path="/login" element={<div>Entrar</div>} />
    </Routes>
  </MemoryRouter>,
);

describe("AdminRoute", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isPlatformAdmin = false;
    authState.loading = false;
  });

  it("não monta o painel enquanto a permissão está sendo verificada", () => {
    authState.loading = true;
    renderRoute();
    expect(screen.getByRole("status", { name: /verificando permissões/i })).toBeVisible();
    expect(screen.queryByText("Painel administrativo")).not.toBeInTheDocument();
  });

  it("envia visitantes para o login", () => {
    renderRoute();
    expect(screen.getByText("Entrar")).toBeVisible();
  });

  it("envia usuários comuns para o próprio painel", () => {
    authState.user = { id: "usuario-comum" };
    renderRoute();
    expect(screen.getByText("Painel do usuário")).toBeVisible();
    expect(screen.queryByText("Painel administrativo")).not.toBeInTheDocument();
  });

  it("monta o painel somente para administrador confirmado pelo banco", () => {
    authState.user = { id: "administrador" };
    authState.isPlatformAdmin = true;
    renderRoute();
    expect(screen.getByText("Painel administrativo")).toBeVisible();
  });
});
