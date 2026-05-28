/**
 * ScreenShake — Applies a decaying random camera-shake offset.
 * Designed for game-loop integration: call `update()` each frame and apply
 * the returned `{ x, y }` offset to your canvas `translate()` or similar.
 * No external dependencies.
 */

export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private remaining = 0;

  /**
   * Trigger a screen shake effect.
   * @param intensity - Maximum pixel offset per axis (default: 4)
   * @param duration  - Duration in frames (default: 10)
   */
  trigger(intensity: number = 4, duration: number = 10): void {
    this.intensity = intensity;
    this.duration = duration;
    this.remaining = duration;
  }

  /**
   * Update shake state and return the current frame's offset.
   * Should be called once per game-loop tick.
   * @returns Offset `{ x, y }` to apply to the canvas; `{ 0, 0 }` when idle.
   */
  update(): { x: number; y: number } {
    if (this.remaining <= 0) {
      return { x: 0, y: 0 };
    }

    // Linear decay: full intensity at start, zero at end
    const progress = this.remaining / this.duration;
    const currentIntensity = this.intensity * progress;

    const offsetX = (Math.random() * 2 - 1) * currentIntensity;
    const offsetY = (Math.random() * 2 - 1) * currentIntensity;

    this.remaining--;

    return { x: Math.round(offsetX), y: Math.round(offsetY) };
  }

  /** Check if the shake effect is currently active */
  isShaking(): boolean {
    return this.remaining > 0;
  }
}
