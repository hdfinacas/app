import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useSessionPreference } from "@/hooks/useSessionPreference";

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

it("recupera a busca ao sair da tela e voltar", () => {
  const first = renderHook(() => useSessionPreference<string>("account-a:search", ""));
  act(() => first.result.current[1]("Maria"));
  first.unmount();
  const next = renderHook(() => useSessionPreference<string>("account-a:search", ""));
  expect(next.result.current[0]).toBe("Maria");
});

it("não compartilha filtros entre contas", () => {
  const hook = renderHook(({ account }) => useSessionPreference<string>(account, ""), { initialProps: { account: "a" } });
  act(() => hook.result.current[1]("Maria"));
  hook.rerender({ account: "b" });
  expect(hook.result.current[0]).toBe("");
  act(() => hook.result.current[1]("João"));
  hook.rerender({ account: "a" });
  expect(hook.result.current[0]).toBe("Maria");
});

it("ignora preferências corrompidas ou fora das opções", () => {
  sessionStorage.setItem("broken", "{");
  sessionStorage.setItem("invalid", '"removed-option"');
  const hook = renderHook(() => [
    useSessionPreference("broken", "all", ["all", "paid"]),
    useSessionPreference("invalid", "all", ["all", "paid"]),
  ]);
  expect(hook.result.current.map(([value]) => value)).toEqual(["all", "all"]);
});
