import { useEffect } from "react";

/**
 * Hook to lock body scrolling when a modal or popup is open.
 * Utilizes a counter on document.body to support multiple open modals/overlays.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      const currentVal = parseInt(document.body.getAttribute("data-modal-count") || "0", 10);
      document.body.setAttribute("data-modal-count", (currentVal + 1).toString());
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (isLocked) {
        const currentVal = parseInt(document.body.getAttribute("data-modal-count") || "0", 10);
        const newVal = Math.max(0, currentVal - 1);
        document.body.setAttribute("data-modal-count", newVal.toString());
        if (newVal === 0) {
          document.body.classList.remove("modal-open");
          document.body.style.overflow = "";
        }
      }
    };
  }, [isLocked]);
}
