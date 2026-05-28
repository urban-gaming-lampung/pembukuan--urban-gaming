import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { GameAction } from '../../engine/useGameInput';

interface DPadProps {
  onPress: (direction: GameAction, isPressed: boolean) => void;
  pressedState?: Record<GameAction, boolean>;
  disabled?: boolean;
}

/**
 * DPad component rendering a classic cross-shaped direction controller.
 * Supports mouse down/up/leave events and touch screen gestures.
 */
export default function DPad({ onPress, pressedState, disabled = false }: DPadProps) {
  const handleTouch = (dir: GameAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onPress(dir, true);
  };

  const handleRelease = (dir: GameAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onPress(dir, false);
  };

  const getBtnClass = (dir: GameAction) => {
    const isPressed = pressedState?.[dir];
    const base =
      'flex items-center justify-center bg-zinc-800 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border border-zinc-700/30 dark:border-zinc-800 transition-all duration-75 shadow-sm';
    const active = isPressed
      ? 'bg-zinc-950 dark:bg-black text-emerald-400 shadow-none translate-y-0.5'
      : '';
    return `${base} ${active}`;
  };

  return (
    <div className={`relative w-28 h-28 flex items-center justify-center shrink-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Background cross guide lines */}
      <div className="absolute w-10 h-28 bg-zinc-400/10 dark:bg-zinc-500/5 rounded-lg pointer-events-none" />
      <div className="absolute w-28 h-10 bg-zinc-400/10 dark:bg-zinc-500/5 rounded-lg pointer-events-none" />

      {/* Center Cap */}
      <div className="absolute w-10 h-10 bg-zinc-850 dark:bg-zinc-950 z-10 rounded shadow-inner pointer-events-none border border-zinc-850 flex items-center justify-center">
        <div className="w-3.5 h-3.5 rounded-full bg-zinc-700/20 dark:bg-zinc-800/40" />
      </div>

      {/* Up Button */}
      <button
        className={`absolute top-0 w-10 h-10 rounded-t-lg ${getBtnClass('UP')}`}
        onTouchStart={(e) => handleTouch('UP', e)}
        onTouchEnd={(e) => handleRelease('UP', e)}
        onMouseDown={(e) => handleTouch('UP', e)}
        onMouseUp={(e) => handleRelease('UP', e)}
        onMouseLeave={(e) => handleRelease('UP', e)}
        aria-label="DPad Up"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      {/* Left Button */}
      <button
        className={`absolute left-0 w-10 h-10 rounded-l-lg ${getBtnClass('LEFT')}`}
        onTouchStart={(e) => handleTouch('LEFT', e)}
        onTouchEnd={(e) => handleRelease('LEFT', e)}
        onMouseDown={(e) => handleTouch('LEFT', e)}
        onMouseUp={(e) => handleRelease('LEFT', e)}
        onMouseLeave={(e) => handleRelease('LEFT', e)}
        aria-label="DPad Left"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Right Button */}
      <button
        className={`absolute right-0 w-10 h-10 rounded-r-lg ${getBtnClass('RIGHT')}`}
        onTouchStart={(e) => handleTouch('RIGHT', e)}
        onTouchEnd={(e) => handleRelease('RIGHT', e)}
        onMouseDown={(e) => handleTouch('RIGHT', e)}
        onMouseUp={(e) => handleRelease('RIGHT', e)}
        onMouseLeave={(e) => handleRelease('RIGHT', e)}
        aria-label="DPad Right"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Down Button */}
      <button
        className={`absolute bottom-0 w-10 h-10 rounded-b-lg ${getBtnClass('DOWN')}`}
        onTouchStart={(e) => handleTouch('DOWN', e)}
        onTouchEnd={(e) => handleRelease('DOWN', e)}
        onMouseDown={(e) => handleTouch('DOWN', e)}
        onMouseUp={(e) => handleRelease('DOWN', e)}
        onMouseLeave={(e) => handleRelease('DOWN', e)}
        aria-label="DPad Down"
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}
