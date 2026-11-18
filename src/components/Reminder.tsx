import React, { useState } from "react";
import { Bell, BookOpen } from "lucide-react";
import { AlertDialog } from "../ui";

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

      <AlertDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        zClassName="z-[400]"
        icon={<BookOpen />}
        iconColor="yellow"
        title="Pengingat Kejujuran"
        actions={[
          { label: "Aamiin", role: "primary", onClick: () => setIsOpen(false) },
        ]}
      >
        <div className="space-y-3 text-center">
          <p className="text-[22px] leading-relaxed font-serif text-label" dir="rtl">
            يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ ٱللَّهَ وَكُونُوا۟ مَعَ ٱلصَّٰدِقِينَ
          </p>
          <div className="h-px w-12 bg-sep mx-auto" />
          <p className="text-footnote italic leading-relaxed text-label-2">
            "Wahai orang-orang yang beriman! Bertakwalah kepada Allah, dan bersamalah kamu dengan orang-orang yang benar (jujur)."
          </p>
          <p className="text-caption font-semibold text-label-3">(QS. At-Taubah: 119)</p>
        </div>
      </AlertDialog>
    </div>
  );
};

export default Reminder;