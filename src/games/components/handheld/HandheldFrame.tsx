import React from 'react';

interface HandheldFrameProps {
  children: React.ReactNode;
  variant?: 'gray' | 'red';
  isPowerOn?: boolean;
}

/**
 * HandheldFrame is a portative console mock wrapping the retro game screen
 * and controls. Uses a clean aesthetic (Apple HIG style) but mimics a retro
 * Game Boy.
 */
export default function HandheldFrame({
  children,
  variant = 'gray',
  isPowerOn = true,
}: HandheldFrameProps) {
  // Styling variant classes
  const frameColorClass =
    variant === 'red'
      ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-800 border-red-700 shadow-red-950/40 text-white'
      : 'bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-zinc-300 dark:border-zinc-800 shadow-zinc-950/20 dark:shadow-black/40 text-zinc-800 dark:text-zinc-200';

  const dotColorClass = isPowerOn ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-zinc-400 dark:bg-zinc-600';

  return (
    <div
      className={`w-full max-w-[460px] mx-auto flex flex-col rounded-[32px] border-4 p-4 shadow-xl relative select-none ${frameColorClass} transition-all duration-300`}
    >
      {/* Title / Status Bar at the top of the console */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1 border-b border-zinc-400/20 dark:border-zinc-500/20">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full transition-all duration-300 ${dotColorClass}`} />
          <span className="text-[8px] font-bold opacity-60 tracking-wider">POWER</span>
        </div>
        <span className="font-pixel text-[9px] tracking-widest opacity-80">
          URBAN ARCADE
        </span>
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400/30 dark:bg-zinc-500/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400/30 dark:bg-zinc-500/30" />
        </div>
      </div>

      {/* Main console content */}
      <div className="mt-3 flex-1 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}
