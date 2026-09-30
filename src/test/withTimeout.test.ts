import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withTimeout } from "@/lib/withTimeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("libera o temporizador quando a requisição termina", async () => {
  await expect(withTimeout(Promise.resolve("ok"))).resolves.toBe("ok");
  expect(vi.getTimerCount()).toBe(0);
});
it("preserva o erro original e libera o temporizador", async () => {
  const error = new Error("Falha de conexão");
  await expect(withTimeout(Promise.reject(error))).rejects.toBe(error);
  expect(vi.getTimerCount()).toBe(0);
});
it("encerra a espera de uma requisição pendente", async () => {
  const check = expect(withTimeout(new Promise(() => {}), 500)).rejects.toThrow("demorou demais");
  await vi.advanceTimersByTimeAsync(500);
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
