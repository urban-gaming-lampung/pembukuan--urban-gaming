import { StackState, COLS, ROWS, checkCollision } from './stackReducer';

// Layout dimensions
const BLOCK_SIZE = 12;
const GRID_X = 140;
const GRID_Y = 30;

/**
 * Calculates the landing Y coordinate for the ghost piece.
 */
function getGhostY(state: StackState): number {
  const ghost = { ...state.currentPiece };
  while (!checkCollision({ ...ghost, y: ghost.y + 1 }, state.board)) {
    ghost.y += 1;
  }
  return ghost.y;
}

/**
 * Renders the Stack Master (Tetris) game display on the canvas.
 * 
 * @param ctx HTML5 Canvas 2D Context.
 * @param state Current Stack game state.
 * @param isDark Flag indicating whether system dark mode is active.
 * @param elapsedMs Game session elapsed milliseconds (used for animations).
 */
export function renderStackGame(
  ctx: CanvasRenderingContext2D,
  state: StackState,
  isDark: boolean,
  elapsedMs: number
) {
  const bg = isDark ? '#1C1C1E' : '#E5E5EA';
  const gridBg = isDark ? '#000000' : '#FFFFFF';
  const gridLine = isDark ? '#2C2C2E' : '#F2F2F7';
  const textLabel = isDark ? '#AEAEB2' : '#8E8E93';
  const textValue = isDark ? '#FFFFFF' : '#000000';
  const borderCol = isDark ? '#3A3A3C' : '#C7C7CC';

  // 1. Clear Screen
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 400, 300);

  // 2. Draw Play Field (Grid Background)
  ctx.fillStyle = gridBg;
  ctx.fillRect(GRID_X, GRID_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

  // Draw Grid lines
  ctx.strokeStyle = gridLine;
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(GRID_X + c * BLOCK_SIZE, GRID_Y);
    ctx.lineTo(GRID_X + c * BLOCK_SIZE, GRID_Y + ROWS * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(GRID_X, GRID_Y + r * BLOCK_SIZE);
    ctx.lineTo(GRID_X + COLS * BLOCK_SIZE, GRID_Y + r * BLOCK_SIZE);
    ctx.stroke();
  }

  // Draw Board boundary
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 2;
  ctx.strokeRect(GRID_X, GRID_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

  // Helper to draw a single retro block cell with bevel highlight
  const drawCell = (x: number, y: number, color: string, alpha = 1) => {
    const rx = GRID_X + x * BLOCK_SIZE;
    const ry = GRID_Y + y * BLOCK_SIZE;

    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(rx, ry, BLOCK_SIZE, BLOCK_SIZE);

    // Bevel highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(rx, ry, BLOCK_SIZE, 2);
    ctx.fillRect(rx, ry, 2, BLOCK_SIZE);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(rx, ry + BLOCK_SIZE - 2, BLOCK_SIZE, 2);
    ctx.fillRect(rx + BLOCK_SIZE - 2, ry, 2, BLOCK_SIZE);

    ctx.globalAlpha = 1.0;
  };

  // 3. Draw Static Blocks on Board
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = state.board[r][c];
      if (color) {
        drawCell(c, r, color);
      }
    }
  }

  // 4. Draw Ghost Piece (Semi-transparent projection)
  if (!state.gameOver) {
    const ghostY = getGhostY(state);
    const matrix = state.currentPiece.matrix;
    const px = state.currentPiece.x;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const gy = ghostY + r;
          const gx = px + c;
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
            // Draw ghost cell as outline or translucent block
            const rx = GRID_X + gx * BLOCK_SIZE;
            const ry = GRID_Y + gy * BLOCK_SIZE;
            
            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(rx, ry, BLOCK_SIZE, BLOCK_SIZE);
            
            ctx.strokeStyle = state.currentPiece.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 0.5, ry + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
          }
        }
      }
    }

    // 5. Draw Current Piece
    const cy = state.currentPiece.y;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const gy = cy + r;
          const gx = px + c;
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
            drawCell(gx, gy, state.currentPiece.color);
          }
        }
      }
    }
  }

  // 6. Draw HOLD Box (Left Side)
  const holdBoxX = 40;
  const holdBoxY = 40;
  const boxW = 60;
  const boxH = 60;

  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(holdBoxX, holdBoxY, boxW, boxH);

  // Label text
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOLD', holdBoxX + boxW / 2, holdBoxY - 5);

  if (state.holdPiece) {
    const hp = state.holdPiece;
    const m = hp.matrix;
    const mSize = m.length;
    // Center alignment offsets inside 60x60 box
    const cellW = 10;
    const px = holdBoxX + (boxW - mSize * cellW) / 2;
    const py = holdBoxY + (boxH - mSize * cellW) / 2;

    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          ctx.fillStyle = hp.color;
          ctx.fillRect(px + c * cellW, py + r * cellW, cellW, cellW);
          ctx.strokeStyle = bg;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px + c * cellW, py + r * cellW, cellW, cellW);
        }
      }
    }
  }

  // 7. Draw NEXT Box (Right Side)
  const nextBoxX = 300;
  const nextBoxY = 40;

  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(nextBoxX, nextBoxY, boxW, boxH);

  ctx.fillStyle = textLabel;
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', nextBoxX + boxW / 2, nextBoxY - 5);

  if (state.nextPiece) {
    const np = state.nextPiece;
    const m = np.matrix;
    const mSize = m.length;
    const cellW = 10;
    const px = nextBoxX + (boxW - mSize * cellW) / 2;
    const py = nextBoxY + (boxH - mSize * cellW) / 2;

    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] !== 0) {
          ctx.fillStyle = np.color;
          ctx.fillRect(px + c * cellW, py + r * cellW, cellW, cellW);
          ctx.strokeStyle = bg;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px + c * cellW, py + r * cellW, cellW, cellW);
        }
      }
    }
  }

  // 8. Draw HUD Stats (Score, Level, Lines)
  // Left column stats
  ctx.textAlign = 'left';
  ctx.fillStyle = textLabel;
  ctx.fillText('LEVEL', holdBoxX, 130);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(String(state.level), holdBoxX, 145);

  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('LINES', holdBoxX, 180);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(String(state.lines), holdBoxX, 195);

  // Right column stats
  ctx.textAlign = 'left';
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('SCORE', nextBoxX, 130);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(String(state.score), nextBoxX, 145);

  // Controls hints at the bottom right
  ctx.fillStyle = textLabel;
  ctx.font = '7px sans-serif';
  ctx.fillText('[A] Hard Drop', nextBoxX, 185);
  ctx.fillText('[B] Hold Piece', nextBoxX, 197);
  ctx.fillText('[UP] Rotate', nextBoxX, 209);
  ctx.fillText('[DOWN] Soft Drop', nextBoxX, 221);

  // 9. Overlay prompt for starting game
  if (state.score === 0 && !state.gameOver && state.board.every(row => row.every(cell => cell === null))) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(GRID_X, GRID_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEKAN START', GRID_X + (COLS * BLOCK_SIZE) / 2, GRID_Y + (ROWS * BLOCK_SIZE) / 2 - 10);
    ctx.fillText('UNTUK MULAI', GRID_X + (COLS * BLOCK_SIZE) / 2, GRID_Y + (ROWS * BLOCK_SIZE) / 2 + 5);
  }
}
