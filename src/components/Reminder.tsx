import React, { useState } from "react";

const Reminder: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 text-zinc-800 dark:text-white font-medium hover:bg-white/20 dark:hover:bg-white/10 transition-all active:scale-95 shadow-lg"
      >
        <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        Tombol Pengingat
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 font-sans">
          <div 
            className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="relative w-full max-w-[340px] overflow-hidden rounded-[24px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/10">
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              
              <h3 className="text-[15px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-4">Pengingat Kejujuran</h3>
              
              <div className="space-y-4">
                <p className="text-[22px] leading-relaxed font-serif text-zinc-900 dark:text-white" dir="rtl">
                  يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ ٱللَّهَ وَكُونُوا۟ مَعَ ٱلصَّٰدِقِينَ
                </p>
                <div className="h-[1px] w-12 bg-zinc-300 dark:bg-white/10 mx-auto" />
                <p className="text-[14px] italic leading-relaxed text-zinc-600 dark:text-zinc-400">
                  "Wahai orang-orang yang beriman! Bertakwalah kepada Allah, dan bersamalah kamu dengan orang-orang yang benar (jujur)."
                </p>
                <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  (QS. At-Taubah: 119)
                </p>
              </div>
            </div>
            
            <div className="border-t border-zinc-200/50 dark:border-white/10">
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-full py-4 text-[17px] font-semibold text-blue-500 active:bg-zinc-200 dark:active:bg-white/10 transition-colors"
              >
                Aamiin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reminder;