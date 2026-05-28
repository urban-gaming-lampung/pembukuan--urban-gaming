/**
 * Haptic feedback utilities for game events.
 * Uses the Vibration API (navigator.vibrate) with graceful fallback
 * for browsers that don't support it.
 */

/**
 * Safely invoke navigator.vibrate with try-catch and feature detection.
 * @param pattern - vibration duration in ms, or an array pattern [vibrate, pause, ...]
 */
function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Silently ignore — vibration is non-critical UX polish
  }
}

/** Light tap for scoring events (10ms) */
export function hapticScore(): void {
  vibrate(10);
}

/** Medium buzz for game over (200ms) */
export function hapticGameOver(): void {
  vibrate(200);
}

/** Celebration pattern for new high score [50, 30, 50, 30, 100] */
export function hapticHighScore(): void {
  vibrate([50, 30, 50, 30, 100]);
}

/** Quick double-tap for power-up collection [20, 40, 20] */
export function hapticPowerUp(): void {
  vibrate([20, 40, 20]);
}

/** Single micro-tap for button press (5ms) */
export function hapticTap(): void {
  vibrate(5);
}
