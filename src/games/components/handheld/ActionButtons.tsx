import React from 'react';
import { GameAction } from '../../engine/useGameInput';

interface ActionButtonsProps {
  onPress: (action: GameAction, isPressed: boolean) => void;
  pressedState?: Record<GameAction, boolean>;
}

/**
 * ActionButtons renders tactile primary A and secondary B buttons,
 * triggering brief vibrations if supported by device hardware.
 */
export default function ActionButtons({ onPress, pressedState }: ActionButtonsProps) {
  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      // Trigger a brief 25ms haptic rumble
      try {
        navigator.vibrate(25);
      } catch (e) {}
    }
  };

  const handleTouch = (action: GameAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    triggerVibration();
    onPress(action, true);
  };

  const handleRelease = (action: GameAction, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onPress(action, false);
  };

  return (
    <div className="flex gap-4 items-center justify-center shrink-0">
      {/* Button B */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          className={`w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 border-4 border-amber-600 dark:border-amber-700 shadow-md flex items-center justify-center text-white font-black text-sm active:scale-90 transition-all duration-75 select-none ${
            pressedState?.B ? 'bg-amber-700 dark:bg-amber-800 translate-y-0.5 shadow-none' : ''
          }`}
          onTouchStart={(e) => handleTouch('B', e)}
          onTouchEnd={(e) => handleRelease('B', e)}
          onMouseDown={(e) => handleTouch('B', e)}
          onMouseUp={(e) => handleRelease('B', e)}
          onMouseLeave={(e) => handleRelease('B', e)}
          aria-label="Action Button B"
        >
          B
        </button>
        <span className="text-[7px] font-bold opacity-40 tracking-wider">CANCEL</span>
      </div>

      {/* Button A */}
      <div className="flex flex-col items-center gap-1.5 mt-3">
        <button
          className={`w-14 h-14 rounded-full bg-red-500 hover:bg-red-450 dark:bg-red-600 dark:hover:bg-red-500 border-4 border-red-600 dark:border-red-700 shadow-lg flex items-center justify-center text-white font-black text-base active:scale-90 transition-all duration-75 select-none ${
            pressedState?.A ? 'bg-red-700 dark:bg-red-800 translate-y-0.5 shadow-none' : ''
          }`}
          onTouchStart={(e) => handleTouch('A', e)}
          onTouchEnd={(e) => handleRelease('A', e)}
          onMouseDown={(e) => handleTouch('A', e)}
          onMouseUp={(e) => handleRelease('A', e)}
          onMouseLeave={(e) => handleRelease('A', e)}
          aria-label="Action Button A"
        >
          A
        </button>
        <span className="text-[7px] font-bold opacity-40 tracking-wider">OK / JUMP</span>
      </div>
    </div>
  );
}
