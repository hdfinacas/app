import { localNoonISO, parseLocalDate } from "@/lib/dateUtils";

/** Aceita tanto 1234.56 quanto a digitação brasileira 1.234,56. */
export function parseFinancialAmount(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const raw = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Igual ao parser monetário, mas admite um ajuste negativo e rejeita zero. */
export function parseFinancialDelta(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0 ? value : null;
  const raw = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount !== 0 ? amount : null;
}

/** Converte uma data válida do formulário sem usar o fallback silencioso de hoje. */
export function parseFinancialDate(value: string): string | null {
  return parseLocalDate(value) ? localNoonISO(value) : null;
}
