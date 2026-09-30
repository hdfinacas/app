import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeMessageContent } from "@/components/agent/SafeMessageContent";

describe("SafeMessageContent", () => {
  it("mostra tags recebidas como texto, sem criar HTML executável", () => {
    const { container } = render(
      <SafeMessageContent content={'<img src=x onerror="alert(1)"> **seguro**'} />,
    );

    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("seguro").tagName).toBe("STRONG");
  });

  it("preserva formatação inline e listas simples", () => {
    const { container } = render(
      <SafeMessageContent content={'- item\nUse `código` e *ênfase*'} />,
    );

    expect(screen.getByText("• item")).toBeInTheDocument();
    expect(screen.getByText("código").tagName).toBe("CODE");
    expect(screen.getByText("ênfase").tagName).toBe("EM");
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });
});
