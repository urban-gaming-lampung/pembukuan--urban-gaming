import { InvadersState, Alien, Shot, Bunker, UFO, CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_Y } from './invadersReducer';

// 8x8 Pixel Art Sprites for Space Invaders (Frame A and B for animation)
const SPRITES = {
  top: [
    // Squid Frame A
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
      [1,0,1,0,0,1,0,1],
    ],
    // Squid Frame B
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,1,1,0,1,0],
      [1,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,1,0],
    ]
  ],
  middle: [
    // Crab Frame A
    [
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1],
    ],
    // Crab Frame B
    [
      [0,0,1,0,0,1,0,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [0,0,1,0,0,1,0,0],
    ]
  ],
  bottom: [
    // Octopus Frame A
    [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,1,1,1,0,0],
      [0,1,0,1,1,0,1,0],
      [1,0,1,0,0,1,0,1],
    ],
    // Octopus Frame B
    [
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,0,0,1,1,0],
      [1,1,0,1,1,0,1,1],
      [0,0,1,0,0,1,0,0],
    ]
  ]
};

const UFO_SPRITE = [
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,0,1,1,0,0,1,1,0,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,1,1,0,0,0,0,1,1,0,0]
];

// Draw retro pixel sprite helper
function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  matrix: number[][],
  color: string
) {
  const pixelW = w / matrix[0].length;
  const pixelH = h / matrix.length;

  ctx.fillStyle = color;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] === 1) {
        ctx.fillRect(
          Math.floor(x + c * pixelW),
          Math.floor(y + r * pixelH),
          Math.ceil(pixelW),
          Math.ceil(pixelH)
        );
      }
    }
  }
}

/**
 * Renders the Space Invaders retro challenge display on the canvas.
 * 
 * @param ctx HTML5 Canvas 2D Context.
 * @param state Current Space Invaders state.
 * @param isDark Flag indicating whether system dark mode is active.
 * @param elapsedMs Game session elapsed milliseconds (used for animations).
 */
export function renderInvadersGame(
  ctx: CanvasRenderingContext2D,
  state: InvadersState,
  isDark: boolean,
  elapsedMs: number
) {
  const bg = isDark ? '#1C1C1E' : '#E5E5EA';
  const playerColor = isDark ? '#30D158' : '#34C759'; // Apple Green
  const alienColors = {
    top: '#BF5AF2',     // Purple
    middle: '#0A84FF',  // Blue
    bottom: '#FFD60A',  // Yellow
  };
  const ufoColor = '#FF453A'; // Red UFO
  const laserColor = isDark ? '#30D158' : '#34C759';
  const alienLaserColor = '#FF453A';
  const textLabel = isDark ? '#AEAEB2' : '#8E8E93';
  const textValue = isDark ? '#FFFFFF' : '#000000';

  // 1. Clear screen
  ctx.fillStyle = isDark ? '#000000' : '#FFFFFF'; // Solid black/white retro screen
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Draw Stars (Deep Space feel, scrolling downwards)
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.15)';
  const starCount = 20;
  for (let i = 0; i < starCount; i++) {
    // Deterministic position based on index & scroll with elapsedMs
    const starX = (Math.sin(i * 12948.24) * 0.5 + 0.5) * CANVAS_WIDTH;
    const starSpeed = (Math.cos(i * 3824.9) * 0.5 + 0.5) * 15 + 5; // pixels per second
    const starY = ((starSpeed * elapsedMs) / 1000 + i * 25) % (CANVAS_HEIGHT - 40);
    ctx.fillRect(starX, starY, 1.5, 1.5);
  }

  // 3. Draw Player Tank/Spaceship
  const px = state.playerX;
  const py = PLAYER_Y;
  const pw = state.playerWidth;
  const ph = state.playerHeight;

  ctx.fillStyle = playerColor;
  // Draw base
  ctx.fillRect(px, py + 3, pw, ph - 3);
  // Draw middle cockpit block
  ctx.fillRect(px + 6, py + 1, pw - 12, 2);
  // Draw gun barrel
  ctx.fillRect(px + pw / 2 - 1, py, 2, 2);

  // 4. Draw Aliens
  const animFrame = Math.floor(elapsedMs / 500) % 2; // alternate frame every 500ms
  state.aliens.forEach((alien) => {
    const spriteList = SPRITES[alien.type];
    const sprite = spriteList[animFrame];
    const color = alienColors[alien.type] || '#FFFFFF';
    drawPixelSprite(ctx, alien.x, alien.y, alien.width, alien.height, sprite, color);
  });

  // 5. Draw UFO
  if (state.ufo) {
    const u = state.ufo;
    drawPixelSprite(ctx, u.x, u.y, u.width, u.height, UFO_SPRITE, ufoColor);
  }

  // 6. Draw Bunkers/Shields
  state.bunkers.forEach((bunker) => {
    const bx = bunker.x;
    const by = bunker.y;
    const bw = bunker.width;
    const bh = bunker.height;

    ctx.fillStyle = playerColor;
    ctx.globalAlpha = bunker.hp / 4; // crumbling transparency representation
    
    // Draw rounded castle bunker block
    ctx.fillRect(bx + 4, by, bw - 8, bh);
    ctx.fillRect(bx, by + 4, bw, bh - 4);

    // Draw archway cutout
    ctx.fillStyle = isDark ? '#000000' : '#FFFFFF';
    ctx.globalAlpha = 1.0;
    ctx.fillRect(bx + 8, by + bh - 6, bw - 16, 6);

    // Crumbling details based on damage
    if (bunker.hp < 4) {
      // Draw pixel cracks
      ctx.fillStyle = isDark ? '#000000' : '#FFFFFF';
      if (bunker.hp <= 3) {
        ctx.fillRect(bx + 6, by + 2, 2, 2);
        ctx.fillRect(bx + 16, by + 5, 2, 2);
      }
      if (bunker.hp <= 2) {
        ctx.fillRect(bx + 2, by + 8, 2, 2);
        ctx.fillRect(bx + 20, by + 3, 2, 2);
      }
      if (bunker.hp <= 1) {
        ctx.fillRect(bx + 12, by + 1, 3, 3);
        ctx.fillRect(bx + 8, by + 7, 2, 2);
      }
    }
  });

  // 7. Draw Lasers/Shots
  state.shots.forEach((shot) => {
    if (shot.vy < 0) {
      // Player laser (green pixel dot with small trial)
      ctx.fillStyle = laserColor;
      ctx.fillRect(shot.x - 1, shot.y, 2, 6);
    } else {
      // Alien laser (red zig-zag effect)
      ctx.fillStyle = alienLaserColor;
      const zigOffset = Math.sin(elapsedMs / 40) > 0 ? 1 : -1;
      ctx.fillRect(shot.x - 1 + zigOffset, shot.y, 2, 6);
    }
  });

  // 8. Draw Border separator
  ctx.strokeStyle = isDark ? '#2C2C2E' : '#D1D1D6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, CANVAS_HEIGHT - 32);
  ctx.lineTo(CANVAS_WIDTH - 10, CANVAS_HEIGHT - 32);
  ctx.stroke();

  // 9. Draw HUD Panel at the bottom
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 15, CANVAS_HEIGHT - 12);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(String(state.score), 15, CANVAS_HEIGHT - 2);

  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`LEVEL ${state.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);

  ctx.fillStyle = textLabel;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('LIVES', CANVAS_WIDTH - 15, CANVAS_HEIGHT - 12);

  // Draw lives as icons
  ctx.fillStyle = playerColor;
  const livesLeft = state.lives;
  for (let i = 0; i < livesLeft; i++) {
    const lx = CANVAS_WIDTH - 15 - (i + 1) * 12;
    const ly = CANVAS_HEIGHT - 8;
    ctx.fillRect(lx, ly, 8, 4);
    ctx.fillRect(lx + 2, ly - 1, 4, 1);
  }

  // 10. Overlay instructions
  if (state.score === 0 && !state.gameOver && state.aliens.length === 28 && state.shots.length === 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(30, 80, CANVAS_WIDTH - 60, 80);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE INVADERS', CANVAS_WIDTH / 2, 105);
    ctx.fillStyle = '#30D158';
    ctx.font = '8px monospace';
    ctx.fillText('TEKAN START UNTUK BERTAHAN', CANVAS_WIDTH / 2, 125);
    ctx.fillStyle = '#8E8E93';
    ctx.fillText('[A] UNTUK TEMBAK LASER', CANVAS_WIDTH / 2, 140);
  }
}
