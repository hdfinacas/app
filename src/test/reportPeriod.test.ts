import { describe, expect, it } from "vitest";
import { buildMonthlyReportRange, buildReportDateRange } from "@/lib/reportPeriod";

describe("reportPeriod", () => {
  it("inclui o último dia inteiro em horário local", () => {
    const range = buildReportDateRange("2026-08-01", "2026-08-31");
    expect(range?.startDay).toBe("2026-08-01");
    expect(range?.endDay).toBe("2026-08-31");
    expect(new Date(range!.endDateTime).getMilliseconds()).toBe(999);
    expect(new Date(range!.endDateTime).getDate()).toBe(31);
    expect(new Date(range!.endDateTime).getHours()).toBe(23);
  });

  it("calcula fevereiro bissexto e rejeita períodos inválidos", () => {
    expect(buildMonthlyReportRange("2028-02")?.endDay).toBe("2028-02-29");
    expect(buildMonthlyReportRange("2026-13")).toBeNull();
    expect(buildReportDateRange("2026-02-31", "2026-03-01")).toBeNull();
    expect(buildReportDateRange("2026-09-01", "2026-08-31")).toBeNull();
  });
});
