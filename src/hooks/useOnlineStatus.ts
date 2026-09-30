import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

/** Fonte única e reativa para decisões de interface que dependem da conexão. */
export const useOnlineStatus = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const hasNetworkConnection = () =>
  typeof navigator === "undefined" || navigator.onLine;
