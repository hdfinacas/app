const PRODUCTION_ORIGIN = "https://credmaisapp.com.br";

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** Resolve URLs de retorno sem confiar diretamente no header Origin. */
export function trustedCheckoutOrigin(
  requestOrigin: string | null,
  appUrl = Deno.env.get("APP_URL"),
  configuredOrigins = Deno.env.get("CHECKOUT_ALLOWED_ORIGINS"),
): string {
  const fallback = normalizeOrigin(appUrl) ?? PRODUCTION_ORIGIN;
  const allowed = new Set([
    PRODUCTION_ORIGIN,
    "https://www.credmaisapp.com.br",
    fallback,
    ...(configuredOrigins ?? "").split(",").map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)),
  ]);
  const candidate = normalizeOrigin(requestOrigin);
  return candidate && allowed.has(candidate) ? candidate : fallback;
}
