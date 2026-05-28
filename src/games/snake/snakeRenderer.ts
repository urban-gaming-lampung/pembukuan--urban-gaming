import { SnakeState } from './snakeReducer';

/**
 * renderSnakeGame draws the current game state to the canvas context.
 * Focuses on a retro pixel aesthetic (anti-aliasing disabled) with subtle gradients
 * and pulse animations.
 * 
 * @param ctx HTML5 Canvas 2D Context.
 * @param state Current Snake state.
 * @param isDark Flag indicating whether system dark mode is active.
 * @param elapsedMs Game session elapsed milliseconds (used for pulsing).
 */
export function renderSnakeGame(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  isDark: boolean,
  elapsedMs: number
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const gridWidth = 20;
  const gridHeight = 20;
  const cellWidth = width / gridWidth;
  const cellHeight = height / gridHeight;

  // 1. Clear Screen with LCD palette background
  ctx.fillStyle = isDark ? '#1C1C1E' : '#E5E5EA';
  ctx.fillRect(0, 0, width, height);

  // 2. Draw Subtle Grid Background
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridWidth; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellWidth, 0);
    ctx.lineTo(i * cellWidth, height);
    ctx.stroke();
  }
  for (let j = 0; j <= gridHeight; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * cellHeight);
    ctx.lineTo(width, j * cellHeight);
    ctx.stroke();
  }

  // 3. Draw Pulsing Food (Classic retro apple)
  const pulse = Math.sin(elapsedMs / 120) * 0.12 + 0.88; // Pulsing scale bounds
  const foodX = state.food.x * cellWidth;
  const foodY = state.food.y * cellHeight;

  ctx.fillStyle = '#FF453A'; // System Red
  ctx.save();
  ctx.translate(foodX + cellWidth / 2, foodY + cellHeight / 2);
  ctx.scale(pulse, pulse);

  // Draw pixel block apple
  const r = cellWidth * 0.4;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  // Draw Green leaf stem
  ctx.fillStyle = '#30D158'; // System Green
  ctx.fillRect(-1.5, -r - 2, 3, 3);
  ctx.restore();

  // 4. Draw Snake Body
  state.snake.forEach((segment, idx) => {
    const isHead = idx === 0;
    const segX = segment.x * cellWidth;
    const segY = segment.y * cellHeight;

    if (isHead) {
      ctx.fillStyle = isDark ? '#30D158' : '#34C759'; // Apple Green head
    } else {
      // Linear gradient opacity from neck to tail
      const ratio = idx / state.snake.length;
      ctx.fillStyle = isDark
        ? `rgba(48, 209, 88, ${0.85 - ratio * 0.5})`
        : `rgba(52, 199, 89, ${0.85 - ratio * 0.5})`;
    }

    // Draw segment with margins to display grid segments clearly
    const margin = 1;
    ctx.fillRect(
      segX + margin,
      segY + margin,
      cellWidth - margin * 2,
      cellHeight - margin * 2
    );

    // Render retro double pixel eyes on head
    if (isHead) {
      ctx.fillStyle = '#000000';
      const eyeSize = Math.max(1.5, cellWidth * 0.12);
      const offset = cellWidth * 0.25;

      if (state.direction === 'UP' || state.direction === 'DOWN') {
        ctx.fillRect(segX + offset, segY + cellHeight / 2 - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(segX + cellWidth - offset - eyeSize, segY + cellHeight / 2 - eyeSize / 2, eyeSize, eyeSize);
      } else {
        ctx.fillRect(segX + cellWidth / 2 - eyeSize / 2, segY + offset, eyeSize, eyeSize);
        ctx.fillRect(segX + cellWidth / 2 - eyeSize / 2, segY + cellHeight - offset - eyeSize, eyeSize, eyeSize);
      }
    }
  });
}
