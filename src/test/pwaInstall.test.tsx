import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePwaInstall } from "@/hooks/usePwaInstall";

describe("usePwaInstall", () => {
  it("compartilha o prompt de instalação entre consumidores", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });

    const first = renderHook(() => usePwaInstall());
    act(() => window.dispatchEvent(event));
    const second = renderHook(() => usePwaInstall());

    expect(first.result.current.canPrompt).toBe(true);
    expect(second.result.current.canPrompt).toBe(true);

    await act(async () => {
      await second.result.current.install();
    });

    expect(prompt).toHaveBeenCalledOnce();
    expect(first.result.current.canPrompt).toBe(false);
    expect(second.result.current.canPrompt).toBe(false);
  });
});
