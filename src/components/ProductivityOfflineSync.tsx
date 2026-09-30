import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { flushProductivityQueue } from "@/lib/offlineProductivity";
import { toast } from "sonner";

export const PRODUCTIVITY_SYNCED_EVENT = "credmais:productivity-synced";

const ProductivityOfflineSync = () => {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const flushing = useRef(false);

  useEffect(() => {
    if (!online || !user || flushing.current) return;
    flushing.current = true;
    void flushProductivityQueue(user.id)
      .then((count) => {
        if (!count) return;
        window.dispatchEvent(new CustomEvent(PRODUCTIVITY_SYNCED_EVENT));
        toast.success(`${count} item${count === 1 ? "" : "s"} offline sincronizado${count === 1 ? "" : "s"}`);
      })
      .finally(() => { flushing.current = false; });
  }, [online, user]);

  return null;
};

export default ProductivityOfflineSync;
