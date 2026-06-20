import React, { useState, useEffect, useRef } from 'react';
import { GameAction } from '../../engine/useGameInput';

interface DPadProps {
  onPress: (direction: GameAction, isPressed: boolean) => void;
  pressedState?: Record<GameAction, boolean>;
  disabled?: boolean;
}

/**
 * Analog joystick replacement for the classic DPad.
 * Integrates smooth touch/mouse drag gestures with spring-back physics,
 * mapping stick deflection to UP, DOWN, LEFT, RIGHT actions.
 */
function DPad({ onPress, pressedState, disabled = false }: DPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activeKeysRef = useRef<Record<'UP' | 'DOWN' | 'LEFT' | 'RIGHT', boolean>>({
    UP: false,
    DOWN: false,
    LEFT: false,
    RIGHT: false,
  });

  const maxRadius = 32; // maximum distance knob can move from center (px)
  const deadZone = 8;    // deadzone to prevent accidental movement triggers

  const handleStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    setIsDragging(true);
    updatePosition(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || disabled) return;
    updatePosition(clientX, clientY);
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    
    // Release all active directions
    const active = activeKeysRef.current;
    if (active.UP) { onPress('UP', false); active.UP = false; }
    if (active.DOWN) { onPress('DOWN', false); active.DOWN = false; }
    if (active.LEFT) { onPress('LEFT', false); active.LEFT = false; }
    if (active.RIGHT) { onPress('RIGHT', false); active.RIGHT = false; }
  };

  const updatePosition = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let newX = dx;
    let newY = dy;

    if (distance > maxRadius) {
      newX = (dx / distance) * maxRadius;
      newY = (dy / distance) * maxRadius;
    }

    setPosition({ x: newX, y: newY });

    const finalDistance = Math.sqrt(newX * newX + newY * newY);
    const active = activeKeysRef.current;

    let targetLeft = false;
    let targetRight = false;
    let targetUp = false;
    let targetDown = false;

    if (finalDistance > deadZone) {
      // Split normalized components
      const threshold = 0.35;
      const normX = newX / maxRadius;
      const normY = newY / maxRadius;

      if (normX > threshold) targetRight = true;
      if (normX < -threshold) targetLeft = true;
      if (normY > threshold) targetDown = true;
      if (normY < -threshold) targetUp = true;
    }

    // Trigger actions on changes
    if (active.LEFT !== targetLeft) {
      onPress('LEFT', targetLeft);
      active.LEFT = targetLeft;
    }
    if (active.RIGHT !== targetRight) {
      onPress('RIGHT', targetRight);
      active.RIGHT = targetRight;
    }
    if (active.UP !== targetUp) {
      onPress('UP', targetUp);
      active.UP = targetUp;
    }
    if (active.DOWN !== targetDown) {
      onPress('DOWN', targetDown);
      active.DOWN = targetDown;
    }
  };

  // Bind window listeners to ensure drag keeps working even outside boundaries
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleWindowMouseUp = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
      window.addEventListener('touchend', handleWindowTouchEnd);
      window.addEventListener('touchcancel', handleWindowTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [isDragging]);

  const knobStyle: React.CSSProperties = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: isDragging ? 'none' : 'transform 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };

  return (
    <div className={`relative w-28 h-28 flex items-center justify-center shrink-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Outer base ring */}
      <div 
        ref={containerRef}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (e.touches[0]) {
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        className="w-28 h-28 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-350 dark:border-zinc-700 shadow-inner flex items-center justify-center relative select-none cursor-pointer"
      >
        {/* Direction indicators (Subtle arrows) */}
        <div className="absolute top-1.5 text-[8px] font-black text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">▲</div>
        <div className="absolute bottom-1.5 text-[8px] font-black text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">▼</div>
        <div className="absolute left-1.5 text-[8px] font-black text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">◀</div>
        <div className="absolute right-1.5 text-[8px] font-black text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">▶</div>

        {/* Center Well */}
        <div className="w-20 h-20 rounded-full bg-zinc-300 dark:bg-zinc-900 border border-zinc-400/40 dark:border-zinc-850 shadow-inner flex items-center justify-center relative pointer-events-none">
          {/* Circular groove decoration */}
          <div className="w-12 h-12 rounded-full border border-dashed border-zinc-450/20 dark:border-zinc-800/30 pointer-events-none" />
          
          {/* Thumb cap (Knob) */}
          <div 
            style={knobStyle}
            className={`w-12 h-12 rounded-full absolute bg-gradient-to-b from-zinc-600 to-zinc-850 dark:from-zinc-700 dark:to-zinc-900 border-2 border-zinc-500/30 dark:border-zinc-800 shadow-md flex items-center justify-center select-none ${
              isDragging ? 'shadow-sm border-emerald-500/50 dark:border-emerald-500/40' : ''
            }`}
          >
            {/* Knob thumb grip indentations */}
            <div className="w-8 h-8 rounded-full border border-zinc-500/20 dark:border-zinc-800/40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-zinc-700/60 dark:bg-zinc-800/80 shadow-inner" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(DPad);
