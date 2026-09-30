export type NotificationCategory =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "support"
  | "billing"
  | "client"
  | "system"
  | "broadcast";

export const notificationCategory = (type?: string | null): NotificationCategory => {
  const value = (type || "info").trim().toLowerCase();
  if (["success", "payment", "paid"].includes(value)) return "success";
  if (["warning", "warn", "overdue", "due"].includes(value)) return "warning";
  if (["error", "danger", "blocked"].includes(value)) return "error";
  if (["support", "ticket"].includes(value)) return "support";
  if (["billing", "subscription"].includes(value)) return "billing";
  if (value === "client") return "client";
  if (value === "system") return "system";
  if (["broadcast", "announcement"].includes(value)) return "broadcast";
  return "info";
};

/** Somente rotas internas absolutas podem ser abertas por uma notificação. */
export const safeNotificationPath = (link?: string | null): string | null => {
  const value = link?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/\p{Cc}/u.test(value)) return null;
  return value;
};
