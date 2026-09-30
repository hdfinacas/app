import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";

vi.mock("@/lib/reportError", () => ({ reportError: vi.fn() }));

function BrokenScreen(): never {
  throw new Error("token-tecnico-que-nao-pode-aparecer");
}

describe("tela global de recuperação", () => {
  it("oferece recuperação sem expor detalhes internos", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ErrorBoundary><BrokenScreen /></ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /algo deu errado/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeVisible();
    expect(screen.queryByText(/token-tecnico/i)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
