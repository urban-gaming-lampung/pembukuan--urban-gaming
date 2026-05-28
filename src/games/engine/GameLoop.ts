import { useEffect, useRef } from 'react';

/**
 * useGameLoop hook provides a standard 60fps requestAnimationFrame game loop.
 * Features pause/resume, delta time tracking, and automatically cleans up on unmount.
 * 
 * @param callback The function to execute on each frame tick, receives delta time in seconds.
 * @param fps Target frames per second (default: 60).
 */
export function useGameLoop(callback: (deltaTime: number) => void, fps = 60) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const callbackRef = useRef(callback);

  // Maintain reference to current callback to avoid re-initializing loop when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const interval = 1000 / fps;
    let accumulatedTime = 0;

    const loop = (time: number) => {
      if (isPausedRef.current) {
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (previousTimeRef.current !== null) {
        const deltaTime = time - previousTimeRef.current;
        accumulatedTime += deltaTime;

        if (accumulatedTime >= interval) {
          // Pass delta time in seconds to the callback
          callbackRef.current(deltaTime / 1000);
          accumulatedTime = accumulatedTime % interval;
        }
      }
      
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [fps]);

  const pause = () => {
    isPausedRef.current = true;
  };

  const resume = () => {
    isPausedRef.current = false;
    previousTimeRef.current = null;
  };

  return { pause, resume };
}
