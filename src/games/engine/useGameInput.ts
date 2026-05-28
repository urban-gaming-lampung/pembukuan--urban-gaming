import { useEffect, useRef, useState } from 'react';

export type GameAction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'A' | 'B' | 'START';

/**
 * useGameInput hook binds both keyboard and touch screen inputs to a standardized
 * set of handheld game actions (UP, DOWN, LEFT, RIGHT, A, B, START).
 * Prevents default browser scrolling on mapped game buttons.
 * 
 * @param onAction Callback triggered immediately when an action state changes (pressed down or released).
 */
export function useGameInput(onAction?: (action: GameAction, isPressed: boolean) => void) {
  const [pressed, setPressed] = useState<Record<GameAction, boolean>>({
    UP: false,
    DOWN: false,
    LEFT: false,
    RIGHT: false,
    A: false,
    B: false,
    START: false,
  });

  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const triggerAction = (action: GameAction, isPressed: boolean) => {
    setPressed((prev) => {
      if (prev[action] === isPressed) return prev;
      return { ...prev, [action]: isPressed };
    });
    
    if (onActionRef.current) {
      onActionRef.current(action, isPressed);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes if focusing input tags (failsafe)
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let action: GameAction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          action = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          action = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          action = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          action = 'RIGHT';
          break;
        case ' ':
        case 'Enter':
          action = 'A';
          break;
        case 'b':
        case 'B':
        case 'Escape':
          action = 'B';
          break;
        case 'p':
        case 'P':
          action = 'START';
          break;
      }

      if (action) {
        e.preventDefault();
        triggerAction(action, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let action: GameAction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          action = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          action = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          action = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          action = 'RIGHT';
          break;
        case ' ':
        case 'Enter':
          action = 'A';
          break;
        case 'b':
        case 'B':
        case 'Escape':
          action = 'B';
          break;
        case 'p':
        case 'P':
          action = 'START';
          break;
      }

      if (action) {
        e.preventDefault();
        triggerAction(action, false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { pressed, triggerAction };
}
