const LAST_SYNC_KEY = "credmais:last-successful-sync";

export const saveLastSuccessfulSync = (timestamp = Date.now()) => {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(timestamp));
  } catch {
    // O modo privado pode bloquear armazenamento; a sincronização continua normal.
  }
  return timestamp;
};

export const loadLastSuccessfulSync = () => {
  try {
    const value = Number(localStorage.getItem(LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export const formatSyncAge = (timestamp: number | null, now = Date.now()) => {
  if (!timestamp) return "dados ainda não sincronizados";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "sincronizado agora";
  if (minutes < 60) return `sincronizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `sincronizado há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `sincronizado há ${days} dia${days === 1 ? "" : "s"}`;
};
