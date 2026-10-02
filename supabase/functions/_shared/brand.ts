const legacyDefaults = new Set(["credmais", "credmais app"]);

export function resolveCompanyName(value?: string | null, fallback = "DH Financeira"): string {
  const name = value?.trim() || "";
  return !name || legacyDefaults.has(name.toLowerCase()) ? fallback : name;
}
