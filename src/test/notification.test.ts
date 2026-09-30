import { describe, expect, it } from "vitest";
import { notificationCategory, safeNotificationPath } from "@/lib/notification";

describe("notificationCategory", () => {
  it("agrupa aliases usados pelo backend nos filtros visuais", () => {
    expect(notificationCategory("payment")).toBe("success");
    expect(notificationCategory("paid")).toBe("success");
    expect(notificationCategory("overdue")).toBe("warning");
    expect(notificationCategory("ticket")).toBe("support");
    expect(notificationCategory("announcement")).toBe("broadcast");
  });
});

describe("safeNotificationPath", () => {
  it("aceita somente rotas internas", () => {
    expect(safeNotificationPath("/suporte")).toBe("/suporte");
    expect(safeNotificationPath("https://example.com")).toBeNull();
    expect(safeNotificationPath("javascript:alert(1)")).toBeNull();
    expect(safeNotificationPath("//example.com")).toBeNull();
  });
});
