import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly into document.body so that parent
 * transforms/overflow never clip a modal (common mobile bug),
 * and locks background scroll while open.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default ModalPortal;
