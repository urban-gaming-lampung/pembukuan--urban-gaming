import { useEffect, useState } from "react";
import { PresenceData } from "../hooks/usePresence";
import { warnaPengguna } from "../ui/foundations/tokens";

/** Sama dengan warna chip pengguna aktif di header (satu sumber: tokens.ts). */
export const getColorForEmailHex = (email: string) => warnaPengguna(email);

export default function LiveCursors({ users, currentUserEmail }: { users: PresenceData[], currentUserEmail?: string }) {
  const [rects, setRects] = useState<Record<string, DOMRect>>({});

  useEffect(() => {
    const hasRemoteFocus = users.some((u) => u.email !== currentUserEmail && Boolean(u.focusedField));
    if (!hasRemoteFocus) {
      setRects((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let ticking = false;
    
    const updateRects = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const newRects: Record<string, DOMRect> = {};
          users.forEach((u) => {
            if (u.focusedField && u.email !== currentUserEmail) {
              // Note: using querySelector can be slightly heavy, but rAF keeps it at 60fps max
              const el = document.querySelector(`[data-fieldid="${u.focusedField}"]`);
              if (el) {
                newRects[u.uid] = el.getBoundingClientRect();
              }
            }
          });
          setRects(newRects);
          ticking = false;
        });
        ticking = true;
      }
    };

    updateRects();
    window.addEventListener("resize", updateRects);
    window.addEventListener("scroll", updateRects, { capture: true, passive: true });
    
    // Polling is required because elements (like dropdowns) might shift position 
    // due to other React state changes without triggering resize/scroll
    const interval = setInterval(updateRects, 100);

    return () => {
      window.removeEventListener("resize", updateRects);
      window.removeEventListener("scroll", updateRects, { capture: true });
      clearInterval(interval);
    };
  }, [users, currentUserEmail]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {users.map((u) => {
        if (u.email === currentUserEmail || !u.focusedField) return null;
        const rect = rects[u.uid];
        if (!rect) return null;
        
        const color = u.profileColor || getColorForEmailHex(u.email);
        
        return (
          <div
            key={u.uid}
            className="absolute border-2 transition-[top,left,width,height] duration-200 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)] rounded-md"
            style={{
              top: rect.top - 2, // slightly expand the border
              left: rect.left - 2,
              width: rect.width + 4,
              height: rect.height + 4,
              borderColor: color,
            }}
          >
            <div
              className="absolute -top-6 left-[-2px] px-2 py-0.5 text-caption2 font-bold text-white rounded-t-md rounded-br-md whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color }}
            >
              {u.email.split('@')[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
