import { useEffect, useState, type SetStateAction } from "react";

/** Remembers this tab's view without sharing searches between accounts. */
export function useSessionPreference<T extends string | boolean>(key: string, fallback: T, allowed?: readonly T[]) {
  const read = (): T => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
      return typeof value === typeof fallback && (!allowed || allowed.includes(value as T)) ? value as T : fallback;
    } catch { return fallback; }
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  useEffect(() => {
    if (state.key !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify(state.value)); } catch { /* Storage can be unavailable. */ }
  }, [key, state]);
  const setValue = (next: SetStateAction<T>) => setState(previous => {
    const current = previous.key === key ? previous.value : read();
    return { key, value: typeof next === "function" ? next(current) : next };
  });
  return [value, setValue] as const;
}
