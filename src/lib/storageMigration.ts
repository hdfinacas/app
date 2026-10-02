/** Move this browser's one-time legacy cache into the DH namespace without losing offline work. */
export function migrateLegacyStorageKey(currentKey: string, legacyKey: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const current = localStorage.getItem(currentKey);
    const legacy = localStorage.getItem(legacyKey);
    if (current === null && legacy !== null) localStorage.setItem(currentKey, legacy);
    if (legacy !== null) localStorage.removeItem(legacyKey);
    return current ?? legacy;
  } catch {
    return null;
  }
}
