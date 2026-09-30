/** Creates one in-app operational alert per admin/day without failing the caller. */
export async function alertPlatformAdmins(
  supabase: any,
  source: string,
  message: string,
): Promise<void> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const marker = `[${source}:${day}]`;
    const { data: admins, error } = await supabase.from("profiles")
      .select("id").eq("is_admin", true).eq("is_blocked", false);
    if (error || !admins?.length) return;

    for (const admin of admins) {
      const { count } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", admin.id)
        .like("message", `${marker}%`);
      if (count) continue;
      await supabase.from("notifications").insert({
        user_id: admin.id,
        from: "system",
        type: "warning",
        link: "/admin",
        message: `${marker} ${message}`.slice(0, 1800),
      });
    }
  } catch (error) {
    console.error(`[operations:${source}] alert failed`, error);
  }
}
