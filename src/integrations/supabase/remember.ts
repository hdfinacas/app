// Persistência opcional de "Lembrar-me" para o login.
// Mantido em arquivo separado porque src/integrations/supabase/client.ts
// é regenerado automaticamente.

const REMEMBER_KEY = "sj_remember_me";

const authStorage = () => (getRememberMe() ? localStorage : sessionStorage);

const moveAuthSession = (from: Storage, to: Storage) => {
  try {
    for (let index = from.length - 1; index >= 0; index -= 1) {
      const key = from.key(index);
      if (!key || !key.includes("-auth-token")) continue;
      const value = from.getItem(key);
      if (value !== null) to.setItem(key, value);
      from.removeItem(key);
    }
  } catch {
    // Storage may be blocked in private browsing; Supabase handles the failure.
  }
};

export const setRememberMe = (remember: boolean) => {
  try {
    const previous = getRememberMe();
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    if (previous !== remember) {
      if (remember) moveAuthSession(sessionStorage, localStorage);
      else moveAuthSession(localStorage, sessionStorage);
    }
  } catch {
    /* noop */
  }
};

/** Storage adapter that follows the preference for every Supabase read/write. */
export const rememberMeStorage: Storage = {
  get length() { return authStorage().length; },
  clear: () => authStorage().clear(),
  getItem: (key) => authStorage().getItem(key),
  key: (index) => authStorage().key(index),
  removeItem: (key) => authStorage().removeItem(key),
  setItem: (key, value) => authStorage().setItem(key, value),
};

export const getRememberMe = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
};
