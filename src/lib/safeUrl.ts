const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Aceita navegação web segura e rejeita esquemas ativos como javascript:. */
export const toSafeHttpUrl = (value: unknown, base?: string): URL | null => {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const fallbackBase = base ?? (typeof window !== "undefined" ? window.location.origin : "https://credmaisapp.com.br");
    const url = new URL(value.trim(), fallbackBase);
    if (url.protocol === "https:") return url;
    if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return url;
    return null;
  } catch {
    return null;
  }
};
