import { RunnerState, CANVAS_WIDTH, CANVAS_HEIGHT, FLOOR_Y, PLAYER_X, PLAYER_WIDTH, PLAYER_HEIGHT } from './runnerReducer';

/**
 * Renders the Neon Runner game display on the canvas.
 * 
 * @param ctx HTML5 Canvas 2D Context.
 * @param state Current Runner state.
 * @param isDark Flag indicating whether system dark mode is active.
 * @param elapsedMs Game session elapsed milliseconds (used for animations).
 */
export function renderRunnerGame(
  ctx: CanvasRenderingContext2D,
  state: RunnerState,
  isDark: boolean,
  elapsedMs: number
) {
  const bg = isDark ? '#1C1C1E' : '#E5E5EA';
  const playerColor = '#0A84FF'; // Neon Cyan/Blue
  const floorColor = isDark ? '#3A3A3C' : '#C7C7CC';
  const obstacleColor = '#FF453A'; // Neon Red
  const coinColor = '#FFD60A'; // Neon Yellow
  const textLabel = isDark ? '#AEAEB2' : '#8E8E93';
  const textValue = isDark ? '#FFFFFF' : '#000000';

  // 1. Clear Screen
  ctx.fillStyle = isDark ? '#0A0A0C' : '#FFFFFF'; // Dark space or white track
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Draw Scrolling Grid Lines (gives 3D depth runner track feel)
  ctx.strokeStyle = isDark ? 'rgba(10, 132, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  ctx.lineWidth = 1;
  const currentSpeed = 150 * state.speedMultiplier;
  const scrollOffset = (currentSpeed * elapsedMs) / 1000;
  
  // Perspective floor grid lines
  const gridSpacing = 40;
  const gridStartX = -(scrollOffset % gridSpacing);
  for (let x = gridStartX; x < CANVAS_WIDTH; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x - 50, CANVAS_HEIGHT);
    ctx.stroke();
  }

  // 3. Draw Floor Line (with gaps carved out)
  ctx.strokeStyle = floorColor;
  ctx.lineWidth = 4;
  
  // Build gap blocks list
  const gaps = state.obstacles.filter((o) => o.type === 'gap');
  let currentFloorX = 0;

  ctx.beginPath();
  gaps.forEach((gap) => {
    // Draw floor up to the gap start
    ctx.moveTo(currentFloorX, FLOOR_Y);
    ctx.lineTo(Math.max(currentFloorX, gap.x), FLOOR_Y);
    currentFloorX = gap.x + gap.width;
  });
  // Draw floor from last gap to end of canvas
  ctx.moveTo(currentFloorX, FLOOR_Y);
  ctx.lineTo(CANVAS_WIDTH, FLOOR_Y);
  ctx.stroke();

  // Draw a secondary glow line under floor
  ctx.strokeStyle = isDark ? 'rgba(10, 132, 255, 0.25)' : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 3);
  ctx.lineTo(CANVAS_WIDTH, FLOOR_Y + 3);
  ctx.stroke();

  // 4. Draw Coins
  state.coins.forEach((coin) => {
    const cx = coin.x + coin.width / 2;
    const cy = coin.y + coin.height / 2;
    const radius = coin.width / 2 + Math.sin(elapsedMs / 80) * 1.2; // pulsing outline

    // Draw coin body
    ctx.fillStyle = coinColor;
    ctx.beginPath();
    ctx.arc(cx, cy, coin.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw shining outline
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 5. Draw Obstacles
  state.obstacles.forEach((o) => {
    if (o.type === 'spike') {
      // Draw neon red spike triangle
      ctx.fillStyle = obstacleColor;
      ctx.beginPath();
      ctx.moveTo(o.x, FLOOR_Y);
      ctx.lineTo(o.x + o.width / 2, o.y);
      ctx.lineTo(o.x + o.width, FLOOR_Y);
      ctx.closePath();
      ctx.fill();

      // Highlight line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (o.type === 'high-wall') {
      // Draw neon red fence / barrier
      ctx.fillStyle = obstacleColor;
      ctx.fillRect(o.x, o.y, o.width, o.height);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.width - 1, o.height - 1);
    }
  });

  // 6. Draw Player (Runner) with animations
  const py = state.playerY;
  const pw = PLAYER_WIDTH;
  const ph = state.isSliding ? PLAYER_HEIGHT / 2 : PLAYER_HEIGHT;

  ctx.fillStyle = playerColor;
  
  if (state.isSliding) {
    // Sliding: Draw long capsule box sliding on floor
    const slideW = PLAYER_WIDTH + 8;
    ctx.fillRect(PLAYER_X, py, slideW, ph);
    // Bevel highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(PLAYER_X + 2, py + 1, slideW - 4, 2);
    // Draw motion trail lines behind sliding player
    ctx.strokeStyle = 'rgba(10, 132, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PLAYER_X - 5, py + ph / 2);
    ctx.lineTo(PLAYER_X - 1, py + ph / 2);
    ctx.moveTo(PLAYER_X - 9, py + ph - 2);
    ctx.lineTo(PLAYER_X - 3, py + ph - 2);
    ctx.stroke();
  } else if (state.isJumping) {
    // Jumping: draw jumping stick / box figure
    if (state.isDoubleJumping) {
      // Spinning flip animation!
      ctx.save();
      ctx.translate(PLAYER_X + pw / 2, py + ph / 2);
      const angle = (elapsedMs / 80) % (Math.PI * 2);
      ctx.rotate(angle);
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-pw / 2 + 1, -ph / 2 + 1, pw - 2, 2); // spinner mark
      ctx.restore();
    } else {
      // Standard jumping posture
      ctx.fillRect(PLAYER_X, py, pw, ph);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(PLAYER_X + 1, py + 1, pw - 2, 3);
    }
  } else {
    // Running Animation: alternating legs
    const runFrame = Math.floor(elapsedMs / 100) % 4;
    // Body torso
    ctx.fillRect(PLAYER_X + 2, py, pw - 4, ph - 6);
    // Head
    ctx.fillRect(PLAYER_X + 4, py - 4, pw - 8, 4);

    // Dynamic legs block rendering
    ctx.fillStyle = playerColor;
    if (runFrame === 0 || runFrame === 2) {
      // Wide legs
      ctx.fillRect(PLAYER_X, py + ph - 6, 3, 6);
      ctx.fillRect(PLAYER_X + pw - 3, py + ph - 6, 3, 6);
    } else {
      // Mid step legs
      ctx.fillRect(PLAYER_X + 3, py + ph - 6, 3, 6);
      ctx.fillRect(PLAYER_X + pw - 6, py + ph - 6, 3, 6);
    }

    // Highlight face visor
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(PLAYER_X + pw - 6, py - 2, 4, 1.5);
  }

  // 7. Draw HUD Panel (Score, Distance, Speed Multiplier)
  // Divider line
  ctx.strokeStyle = isDark ? '#2C2C2E' : '#D1D1D6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, FLOOR_Y + 45);
  ctx.lineTo(CANVAS_WIDTH - 10, FLOOR_Y + 45);
  ctx.stroke();

  // Score
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 15, FLOOR_Y + 62);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(String(state.score), 15, FLOOR_Y + 73);

  // Speed multiplier
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SPEED ${state.speedMultiplier.toFixed(2)}x`, CANVAS_WIDTH / 2, FLOOR_Y + 62);

  // Distance
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('DISTANCE', CANVAS_WIDTH - 15, FLOOR_Y + 62);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.floor(state.distance)}m`, CANVAS_WIDTH - 15, FLOOR_Y + 73);

  // 8. Draw Start message
  if (state.score === 0 && state.distance === 0 && state.obstacles.length === 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(40, 50, CANVAS_WIDTH - 80, 110);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEON RUNNER', CANVAS_WIDTH / 2, 75);
    ctx.fillStyle = '#0A84FF';
    ctx.font = '8px monospace';
    ctx.fillText('TEKAN START UNTUK BERLARI', CANVAS_WIDTH / 2, 95);
    ctx.fillStyle = '#8E8E93';
    ctx.font = '7px monospace';
    ctx.fillText('[A] LOMPAT / LOMPAT GANDA', CANVAS_WIDTH / 2, 115);
    ctx.fillText('[B] KELAS KAN (SLIDE)', CANVAS_WIDTH / 2, 130);
    ctx.fillText('[DOWN] SLAM TURUN (GROUND POUND)', CANVAS_WIDTH / 2, 145);
  }
}
