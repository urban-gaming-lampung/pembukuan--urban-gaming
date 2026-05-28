/**
 * PixelConfetti — A lightweight pixel-art particle system for canvas overlays.
 * Renders small colored squares that burst upward and fall with gravity,
 * fading out over their lifetime. No external dependencies.
 */

/** Retro color palette for confetti particles */
const RETRO_COLORS = ['#30D158', '#FFD60A', '#FF453A', '#0A84FF', '#BF5AF2', '#FF9F0A'];

/** Internal particle state */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export class PixelConfetti {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private particles: Particle[] = [];

  /** Initialize with a canvas context and dimensions */
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /**
   * Trigger a burst of pixel particles from center-top.
   * @param count - Number of particles to spawn (default: 30)
   */
  burst(count: number = 30): void {
    const centerX = this.width / 2;
    const topY = 0;

    for (let i = 0; i < count; i++) {
      const maxLife = 60 + Math.floor(Math.random() * 61); // 60–120 frames
      this.particles.push({
        x: centerX,
        y: topY,
        vx: (Math.random() * 6) - 3,       // -3 to 3
        vy: (Math.random() * -4) - 2,       // -6 to -2
        color: RETRO_COLORS[i % RETRO_COLORS.length],
        size: 2 + Math.floor(Math.random() * 3), // 2–4 pixels
        life: maxLife,
        maxLife,
        gravity: 0.15,
      });
    }
  }

  /**
   * Update particle positions and apply gravity.
   * Call once per game-loop frame.
   * @param _dt - Delta time (reserved for future use; physics are frame-based)
   */
  update(_dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Draw particles as small colored pixel squares with alpha fade-out */
  draw(): void {
    const prevAlpha = this.ctx.globalAlpha;

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    this.ctx.globalAlpha = prevAlpha;
  }

  /** Check if any particles are still alive */
  isActive(): boolean {
    return this.particles.length > 0;
  }
}
