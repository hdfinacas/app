const LEGACY_DEFAULT_BRANDS = new Set(["credmais app", "credmais"]);

export const DEFAULT_COMPANY_NAME = "DH Financeira";

/** Replace the old product default while preserving each white-label tenant's own brand. */
export function resolveCompanyName(value?: string | null, fallback = DEFAULT_COMPANY_NAME): string {
  const name = value?.trim() || "";
  if (!name || LEGACY_DEFAULT_BRANDS.has(name.toLocaleLowerCase("pt-BR"))) return fallback;
  return name;
}

export function resolveBrandText(value?: string | null, fallback = ""): string {
  const text = value?.trim() || "";
  if (!text) return fallback;
  return text.replace(/\bcredmais\s+app\b/gi, DEFAULT_COMPANY_NAME);
}
