const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const key = (userId: string) => `credmais-offline-session:${userId}`;

export type OfflineSession<T> = {
  profile: T;
  isPlatformAdmin: boolean;
  savedAt: number;
};

export const saveOfflineSession = <T>(userId: string, profile: T, isPlatformAdmin: boolean) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ profile, isPlatformAdmin, savedAt: Date.now() }));
  } catch {
    // Armazenamento privado/cheio: o app segue online normalmente.
  }
};

export const loadOfflineSession = <T>(userId: string, now = Date.now()): OfflineSession<T> | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(userId)) || "null") as OfflineSession<T> | null;
    if (!parsed?.profile || !Number.isFinite(parsed.savedAt) || now - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearOfflineSession = (userId: string) => {
  try { localStorage.removeItem(key(userId)); } catch {}
};
