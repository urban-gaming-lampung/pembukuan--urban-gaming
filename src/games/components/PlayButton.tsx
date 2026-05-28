import React from 'react';
import { GameType } from '../types';
import { GAME_NAMES_ID } from '../constants';

interface PlayButtonProps {
  gameType: GameType;
  monthKey: string;
  onClick: () => void;
}

/**
 * PlayButton component that launches the retro game challenge.
 * Styled as a premium tactile arcade-style green button with pixelated text.
 */
export default function PlayButton({ gameType, monthKey, onClick }: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full py-4 px-6 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-600 dark:to-green-700 text-white font-pixel text-[11px] tracking-widest shadow-lg shadow-green-500/20 dark:shadow-green-950/40 border border-emerald-400/20 active:scale-[0.97] hover:scale-[1.01] hover:shadow-xl transition-all duration-150 select-none flex items-center justify-center gap-2"
      aria-label={`Mainkan Game ${gameType}`}
    >
      {/* Shimmer overlay on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none" />
      
      <span className="relative z-20 flex items-center gap-2">
        <span>▶</span>
        <span>MAINKAN</span>
      </span>
    </button>
  );
}
