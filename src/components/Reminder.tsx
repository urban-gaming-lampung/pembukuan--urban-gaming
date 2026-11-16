import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BookOpen } from "lucide-react";
import { IconBadge } from "../ui";

const Reminder: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full apple-card ring-1 ring-edge shadow-card px-4 text-subhead font-semibold text-label transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/40"
      >
        <Bell className="w-4 h-4 text-warning" />
        <span>Tombol Pengingat</span>
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 font-sans" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-[340px] overflow-hidden rounded-sheet apple-sheet p-3.5 shadow-float border border-white/65 dark:border-white/[0.14] animate-in zoom-in-95 duration-200 ring-1 ring-black/10 dark:ring-white/10">
            <div className="px-3.5 pt-3.5 pb-5 text-center">
              <div className="mx-auto mb-5 flex justify-center">
                <IconBadge color="yellow" variant="tinted" className="h-14 w-14 rounded-full [&>svg]:h-7 [&>svg]:w-7">
                  <BookOpen />
                </IconBadge>
              </div>

              <h3 className="text-caption font-bold text-warning uppercase tracking-widest mb-4">
                Pengingat Kejujuran
              </h3>

              <div className="space-y-4">
                <p className="text-[22px] leading-relaxed font-serif text-label" dir="rtl">
                  يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ ٱللَّهَ وَكُونُوا۟ مَعَ ٱلصَّٰدِقِينَ
                </p>
                <div className="h-px w-12 bg-sep mx-auto" />
                <p className="text-subhead italic leading-relaxed text-label-2">
                  "Wahai orang-orang yang beriman! Bertakwalah kepada Allah, dan bersamalah kamu dengan orang-orang yang benar (jujur)."
                </p>
                <p className="text-caption font-semibold text-label-3">
                  (QS. At-Taubah: 119)
                </p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full min-h-[48px] rounded-full bg-action text-action-label text-subhead font-semibold hover:opacity-85 active:opacity-75 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint"
              >
                Aamiin
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Reminder;