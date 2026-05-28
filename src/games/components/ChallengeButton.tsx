import React from 'react';
import { Gamepad2, Lock } from 'lucide-react';

interface ChallengeButtonProps {
  isAbsenDone: boolean;
  activeGameName: string;
  onClick: () => void;
}

/**
 * ChallengeButton component displayed on the main dashboard tab.
 * Prompts the user to enter the monthly retro challenge if they have completed daily check-in.
 */
export default function ChallengeButton({
  isAbsenDone,
  activeGameName,
  onClick,
}: ChallengeButtonProps) {

  if (isAbsenDone) {
    return (
      <button
        onClick={onClick}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-600 dark:to-green-700 p-5 text-white shadow-lg shadow-green-500/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] font-sans"
        aria-label="Buka Tantangan Game Bulan Ini"
      >
        {/* Shimmer animation effect */}
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        <div className="flex items-center gap-4 relative z-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-md shadow-inner">
            <Gamepad2 className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-pixel text-[10px] tracking-wider text-green-100 uppercase opacity-90">
              CHALLENGE BULAN INI
            </span>
            <span className="text-lg font-black tracking-tight mt-0.5 capitalize leading-tight">
              {activeGameName || 'Loading game...'}
            </span>
          </div>
        </div>

        <div className="flex h-8 items-center justify-center rounded-xl bg-white/20 px-3 text-xs font-bold backdrop-blur-md relative z-20">
          Mainkan 🎮
        </div>
      </button>
    );
  }

  // Disabled state (Employee has not checked-in yet)
  return (
    <div
      className="relative flex w-full items-center justify-between rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 p-5 text-zinc-400 dark:text-zinc-500 cursor-not-allowed select-none font-sans"
      aria-disabled="true"
      title="Absen masuk dulu untuk unlock 🎮"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600">
          <Lock className="h-5 w-5" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-pixel text-[9px] tracking-wider text-zinc-400 dark:text-zinc-600 uppercase">
            CHALLENGE TERKUNCI
          </span>
          <span className="text-[14px] font-bold tracking-tight mt-1 text-zinc-500 dark:text-zinc-400 leading-tight">
            Absen masuk dulu untuk unlock 🎮
          </span>
        </div>
      </div>

      <div className="flex h-8 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800 px-3 text-[11px] font-bold text-zinc-400 dark:text-zinc-600">
        Kunci 🔒
      </div>
    </div>
  );
}
