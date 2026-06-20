import React from 'react';
import { Volume2, VolumeX, RotateCcw, Play, Pause } from 'lucide-react';

interface SystemButtonsProps {
  onStartPause: () => void;
  onReset: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  gameStatus: 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SUBMITTING';
}

/**
 * SystemButtons displays administrative game controllers such as Start/Pause,
 * Resetting states, and Muting synthesizer sounds.
 */
function SystemButtons({
  onStartPause,
  onReset,
  isMuted,
  onToggleMute,
  gameStatus,
}: SystemButtonsProps) {
  return (
    <div className="w-full flex items-center justify-between px-4 pt-3 pb-1 border-t border-zinc-400/10 dark:border-zinc-500/10 mt-3 select-none">
      {/* Sound Mute/Unmute Toggle */}
      <button
        onClick={onToggleMute}
        className="flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 active:scale-95 transition-all focus:outline-none"
        aria-label="Toggle Sound Mute"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-400/20 dark:bg-zinc-800/80 border border-zinc-400/10 dark:border-zinc-700/30 shadow-inner">
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-zinc-500" />
          ) : (
            <Volume2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          )}
        </div>
        <span className="text-[6px] font-black tracking-wider uppercase opacity-50">SOUND</span>
      </button>

      {/* START / PAUSE Controller */}
      <button
        onClick={onStartPause}
        disabled={gameStatus === 'GAME_OVER' || gameStatus === 'SUBMITTING'}
        className={`flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 active:scale-95 transition-all focus:outline-none ${
          gameStatus === 'GAME_OVER' || gameStatus === 'SUBMITTING' ? 'opacity-30 cursor-not-allowed' : ''
        }`}
        aria-label="Start or Pause Game"
      >
        <div className="flex h-8 w-16 items-center justify-center rounded-2xl bg-zinc-400/20 dark:bg-zinc-800/80 border border-zinc-400/10 dark:border-zinc-700/30 px-3 shadow-inner">
          {gameStatus === 'PLAYING' ? (
            <Pause className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          ) : (
            <Play className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500 animate-pulse" />
          )}
        </div>
        <span className="text-[6px] font-black tracking-wider uppercase opacity-50">START / PAUSE</span>
      </button>

      {/* RESET Controller */}
      <button
        onClick={onReset}
        disabled={gameStatus === 'IDLE' || gameStatus === 'SUBMITTING'}
        className={`flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 active:scale-95 transition-all focus:outline-none ${
          gameStatus === 'IDLE' || gameStatus === 'SUBMITTING' ? 'opacity-30 cursor-not-allowed' : ''
        }`}
        aria-label="Reset Game"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-400/20 dark:bg-zinc-800/80 border border-zinc-400/10 dark:border-zinc-700/30 shadow-inner">
          <RotateCcw className="h-4 w-4 text-red-500 dark:text-red-400" />
        </div>
        <span className="text-[6px] font-black tracking-wider uppercase opacity-50">RESET</span>
      </button>
    </div>
  );
}

export default React.memo(SystemButtons);
