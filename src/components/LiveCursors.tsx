import React, { useEffect, useState } from "react";
import { PresenceData } from "../hooks/usePresence";

const USER_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
];

export function getColorForEmailHex(email: string) {
  if (!email) return "#3b82f6";
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export default function LiveCursors({ users, currentUserEmail }: { users: PresenceData[], currentUserEmail?: string }) {
  const [rects, setRects] = useState<Record<string, DOMRect>>({});

  useEffect(() => {
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
            className="absolute border-2 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)] rounded-md"
            style={{
              top: rect.top - 2, // slightly expand the border
              left: rect.left - 2,
              width: rect.width + 4,
              height: rect.height + 4,
              borderColor: color,
            }}
          >
            <div
              className="absolute -top-6 left-[-2px] px-2 py-0.5 text-[11px] font-bold text-white rounded-t-md rounded-br-md whitespace-nowrap shadow-sm"
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
