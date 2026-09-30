import { parseLocalDate } from "@/lib/dateUtils";

export type ReportDateRange = {
  startDay: string;
  endDay: string;
  startDateTime: string;
  endDateTime: string;
};

/** Limites de dias locais inclusivos, prontos para colunas date e timestamptz. */
export function buildReportDateRange(from: string, to: string): ReportDateRange | null {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!start || !end || from > to) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { startDay: from, endDay: to, startDateTime: start.toISOString(), endDateTime: end.toISOString() };
}

export function buildMonthlyReportRange(month: string): ReportDateRange | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  const endDate = new Date(year, mon, 0).getDate();
  return buildReportDateRange(
    `${year}-${String(mon).padStart(2, "0")}-01`,
    `${year}-${String(mon).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`,
  );
}
