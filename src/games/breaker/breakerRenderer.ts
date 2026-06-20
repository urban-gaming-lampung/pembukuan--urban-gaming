import { BreakerState, CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_Y, PADDLE_HEIGHT, BALL_RADIUS, BRICK_WIDTH, BRICK_HEIGHT, BRICK_GAP, BRICK_X_OFFSET, BRICK_Y_OFFSET } from './breakerReducer';

/**
 * renderBreakerGame renders the current brick breaker game frame on the canvas context.
 * 
 * @param ctx HTML5 Canvas 2D Context.
 * @param state Current Brick Breaker state.
 * @param isDark Flag indicating whether system dark mode is active.
 * @param elapsedMs Game session elapsed milliseconds (used for animations).
 */
export function renderBreakerGame(
  ctx: CanvasRenderingContext2D,
  state: BreakerState,
  isDark: boolean,
  elapsedMs: number
) {
  // 1. Clear Screen
  ctx.fillStyle = isDark ? '#1C1C1E' : '#E5E5EA';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Draw Bricks
  const rowColors = [
    '#00E5FF', // Cyan
  ];

  state.bricks.forEach((brick) => {
    if (brick.hp <= 0) return;

    const bx = BRICK_X_OFFSET + brick.x * (BRICK_WIDTH + BRICK_GAP);
    const by = BRICK_Y_OFFSET + brick.y * (BRICK_HEIGHT + BRICK_GAP);

    // Pick brick base color
    ctx.fillStyle = rowColors[brick.y % rowColors.length];
    
    // Draw solid brick body
    ctx.fillRect(bx, by, BRICK_WIDTH, BRICK_HEIGHT);

    // Overlay for multi-hit bricks
    if (brick.hp > 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(bx, by, BRICK_WIDTH, BRICK_HEIGHT / 2);
    }

    // Power-up brick indicator border
    if (brick.isPowerUpBrick) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      // Pulsing border on power-ups
      const borderPulse = Math.sin(elapsedMs / 100) * 0.4 + 0.6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${borderPulse})`;
      ctx.strokeRect(bx + 1, by + 1, BRICK_WIDTH - 2, BRICK_HEIGHT - 2);
    } else {
      // Standard dark border to separate blocks
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, BRICK_WIDTH, BRICK_HEIGHT);
    }
  });

  // 3. Draw Paddle
  ctx.fillStyle = isDark ? '#30D158' : '#34C759'; // Apple Green paddle
  
  // Draw rounded corner paddle
  const radius = 3;
  const px = state.paddleX;
  const py = PADDLE_Y;
  const pw = state.paddleWidth;
  const ph = PADDLE_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(px + radius, py);
  ctx.lineTo(px + pw - radius, py);
  ctx.quadraticCurveTo(px + pw, py, px + pw, py + radius);
  ctx.lineTo(px + pw, py + ph - radius);
  ctx.quadraticCurveTo(px + pw, py + ph, px + pw - radius, py + ph);
  ctx.lineTo(px + radius, py + ph);
  ctx.quadraticCurveTo(px, py + ph, px, py + ph - radius);
  ctx.lineTo(px, py + radius);
  ctx.quadraticCurveTo(px, py, px + radius, py);
  ctx.closePath();
  ctx.fill();

  // Draw highlight on paddle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(px + radius, py + 1, pw - radius * 2, 2);

  // 4. Draw Falling Powerups
  state.powerUps.forEach((p) => {
    // Capsule dimensions
    const capWidth = 14;
    const capHeight = 8;
    
    // Choose capsule color
    let capColor = '#0A84FF'; // Default Blue (Multiball)
    let label = 'M';
    if (p.type === 'wide') {
      capColor = '#30D158'; // Green (Wide)
      label = 'W';
    } else if (p.type === 'slow') {
      capColor = '#FF9F0A'; // Orange (Slow)
      label = 'S';
    }

    // Draw capsule background
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(p.x - capWidth / 4, p.y, capHeight / 2, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.arc(p.x + capWidth / 4, p.y, capHeight / 2, (3 * Math.PI) / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Draw white capsule outline
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Letter Label inside capsule
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 0.5);
  });

  // 5. Draw Balls
  state.balls.forEach((ball) => {
    ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Subtle reflection dot on balls
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(ball.x - 1, ball.y - 1, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6. Draw HUD overlays inside canvas (Level info, lives left)
  // Lives represented as hearts
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  
  // Draw lives hearts
  for (let i = 0; i < state.lives; i++) {
    drawHeart(ctx, 16 + i * 11, CANVAS_HEIGHT - 13, 7);
  }

  // Draw Level text
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${state.level}`, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 6);

  // Draw Launch message if ball is not launched
  if (!state.ballLaunched && state.lives > 0 && !state.gameOver) {
    ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEKAN [A] UNTUK MULAI', CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.65);
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  // top left curve
  ctx.bezierCurveTo(
    x - size / 2, y - topCurveHeight / 2,
    x - size / 2, y + size / 2,
    x, y + size
  );
  // top right curve
  ctx.bezierCurveTo(
    x + size / 2, y + size / 2,
    x + size / 2, y - topCurveHeight / 2,
    x, y + topCurveHeight
  );
  ctx.closePath();
  ctx.fillStyle = '#FF453A'; // Apple Red
  ctx.fill();
  ctx.restore();
}
