import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hasNetworkConnection, useOnlineStatus } from "@/hooks/useOnlineStatus";

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
};

describe("useOnlineStatus", () => {
  afterEach(() => setOnline(true));

  it("acompanha perda e restauração da conexão", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("expõe a verificação imperativa para ações críticas", () => {
    setOnline(false);
    expect(hasNetworkConnection()).toBe(false);
    setOnline(true);
    expect(hasNetworkConnection()).toBe(true);
  });
});
