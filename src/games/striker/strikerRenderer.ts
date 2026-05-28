import {
  StrikerState,
  Bullet,
  Enemy,
  Boss,
  Item,
  Particle,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAY_MIN_X,
  PLAY_MAX_X,
  PLAY_WIDTH,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
} from './strikerReducer';

// 8x8 matrix representation for POW capsule
const POW_MATRIX = [
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 0, 0, 0, 1, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 0, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
];

// Helper to draw a pixel-matrix sprite
function drawPixelMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  matrix: number[][],
  color: string
) {
  const pxW = w / matrix[0].length;
  const pxH = h / matrix.length;
  ctx.fillStyle = color;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] === 1) {
        ctx.fillRect(
          Math.floor(x - w / 2 + c * pxW),
          Math.floor(y - h / 2 + r * pxH),
          Math.ceil(pxW),
          Math.ceil(pxH)
        );
      }
    }
  }
}

// Render player P-38 airplane
function drawPlayerP38(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isRolling: boolean,
  rollTimer: number
) {
  ctx.save();
  ctx.translate(x, y);

  if (isRolling) {
    // Barrel roll scale factor: 1.0 -> 1.5 -> 1.0
    // rollTimer goes from 1000 to 0. progress is 0 to 1
    const progress = (1000 - rollTimer) / 1000;
    const scale = 1.0 + Math.sin(progress * Math.PI) * 0.5;
    ctx.scale(scale, scale);
    ctx.rotate(progress * Math.PI * 2);

    // Roll wind trail
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw P-38 wings
  ctx.fillStyle = '#8a9ea7';
  ctx.fillRect(-22, -2, 44, 4); // Main Wing

  // Dual Tails (Booms)
  ctx.fillStyle = '#5c6f78';
  ctx.fillRect(-12, -9, 4, 18); // Left Boom
  ctx.fillRect(8, -9, 4, 18);  // Right Boom
  
  // Rear Elevator bridge
  ctx.fillStyle = '#47565e';
  ctx.fillRect(-12, 7, 24, 2);

  // Fuselage / Cockpit Pod
  ctx.fillStyle = '#acb9bf';
  ctx.fillRect(-3, -11, 6, 17);

  // Cockpit glass
  ctx.fillStyle = '#00E5FF';
  ctx.fillRect(-2, -6, 4, 4);

  // Propellers spinning circle outlines
  ctx.strokeStyle = 'rgba(240, 240, 240, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-10, -9, 6, 0, Math.PI * 2);
  ctx.arc(10, -9, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Propeller nose spinner cone (Red)
  ctx.fillStyle = '#D32F2F';
  ctx.fillRect(-11, -10, 2, 2);
  ctx.fillRect(9, -10, 2, 2);

  ctx.restore();
}

// Render Enemy aircraft models
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'scout') {
    // Scout green agile plane
    ctx.fillStyle = '#4CAF50';
    // Wings
    ctx.fillRect(-10, -1, 20, 2);
    // Fuselage
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(-2, -6, 4, 12);
    // Yellow nose
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(-1, -7, 2, 1);
  } else if (e.type === 'fighter') {
    // Fighter red plane
    ctx.fillStyle = '#E53935';
    // Wings
    ctx.fillRect(-12, -2, 24, 3);
    // Fuselage
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(-3, -7, 6, 14);
    // Nose prop
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-2, -8, 4, 1);
  } else if (e.type === 'bomber') {
    // Large heavy bomber
    ctx.fillStyle = '#78909C';
    // Wings
    ctx.fillRect(-28, -4, 56, 6);
    // Heavy Body
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-7, -14, 14, 28);
    // Canopy
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-4, -8, 8, 4);
    // Left / Right engine nacelles on wings
    ctx.fillStyle = '#455A64';
    ctx.fillRect(-16, -6, 4, 10);
    ctx.fillRect(12, -6, 4, 10);
    // Prop circles
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-14, -6, 6, 0, Math.PI * 2);
    ctx.arc(14, -6, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === 'pow') {
    // Orange item carrier plane
    ctx.fillStyle = '#FF9800';
    ctx.fillRect(-11, -2, 22, 3);
    ctx.fillStyle = '#E65100';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-1, -8, 2, 1);
  }

  ctx.restore();
}

// Render Bosses
function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, stage: number) {
  ctx.save();
  ctx.translate(b.x, b.y);

  if (stage === 1) {
    // Bomber KAI: Large dark green bomber
    ctx.fillStyle = '#2E7D32';
    // Massive Wings
    ctx.fillRect(-45, -5, 90, 8);
    // Heavy Fuselage
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(-12, -20, 24, 40);
    // Cockpit windows
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-7, -12, 14, 5);
    // 4 Wing Engines
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(-32, -8, 6, 12);
    ctx.fillRect(-18, -8, 6, 12);
    ctx.fillRect(12, -8, 6, 12);
    ctx.fillRect(26, -8, 6, 12);
  } else if (stage === 2) {
    // Battleship Nagato: Ship hull on the scrolling sea
    // Draw waves spray on the sides
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-b.width / 2 - 4, -b.height / 2 + 5, 3, b.height - 10);
    ctx.fillRect(b.width / 2 + 1, -b.height / 2 + 5, 3, b.height - 10);

    // Ship Hull
    ctx.fillStyle = '#546E7A';
    ctx.beginPath();
    ctx.moveTo(0, -b.height / 2 - 10);
    ctx.lineTo(b.width / 2, -b.height / 2);
    ctx.lineTo(b.width / 2, b.height / 2);
    ctx.lineTo(-b.width / 2, b.height / 2);
    ctx.lineTo(-b.width / 2, -b.height / 2);
    ctx.closePath();
    ctx.fill();

    // Deck components
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-15, -12, 30, 24);
    // Main Turrets (Front and Back)
    ctx.fillStyle = '#263238';
    ctx.fillRect(-6, -18, 12, 6);
    ctx.fillRect(-6, 12, 12, 6);
    // Barrels
    ctx.fillStyle = '#78909C';
    ctx.fillRect(-2, -24, 1, 6);
    ctx.fillRect(1, -24, 1, 6);
    ctx.fillRect(-2, 18, 1, 6);
    ctx.fillRect(1, 18, 1, 6);
  } else {
    // Super Bomber Ayako: Huge silver airplane
    ctx.fillStyle = '#B0BEC5';
    // Huge wings span
    ctx.fillRect(-65, -6, 130, 10);
    // Main Body
    ctx.fillStyle = '#78909C';
    ctx.fillRect(-18, -25, 36, 50);
    // Glass dome nose
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-9, -18, 18, 6);
    // Red wing markings
    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(-45, -6, 12, 10);
    ctx.fillRect(33, -6, 12, 10);
    // Four heavy engine pods
    ctx.fillStyle = '#455A64';
    ctx.fillRect(-42, -9, 8, 15);
    ctx.fillRect(-24, -9, 8, 15);
    ctx.fillRect(16, -9, 8, 15);
    ctx.fillRect(34, -9, 8, 15);
  }

  ctx.restore();
}

/**
 * Main game renderer for Sky Striker challenge.
 */
export function renderStrikerGame(
  ctx: CanvasRenderingContext2D,
  state: StrikerState,
  isDark: boolean,
  elapsedMs: number,
  isIdle: boolean = false
) {
  if (isIdle) {
    // 1. Clear Canvas with solid dark blue/navy
    ctx.fillStyle = '#000020';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Slow scrolling background stars (deterministic, no state overhead)
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 53.7) % (CANVAS_WIDTH - 20)) + 10;
      const y = (elapsedMs * 0.03 + i * 45) % CANVAS_HEIGHT;
      ctx.fillRect(x, y, 2, 2);
    }
    return;
  }

  // Theme coloring variables
  const borderColor = isDark ? '#2C2C2E' : '#D1D1D6';
  const panelBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const panelGrid = isDark ? '#2C2C2E' : '#E5E5EA';
  const textTitle = isDark ? '#30D158' : '#34C759'; // Retro Green
  const textLabel = isDark ? '#AEAEB2' : '#8E8E93';
  const textValue = isDark ? '#FFFFFF' : '#000000';

  // 1. Clear Canvas
  ctx.fillStyle = isDark ? '#000000' : '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // ==================== PLAYING SCREEN AREA ====================
  // Play Area Background: Ocean deep blue
  ctx.fillStyle = '#0D47A1';
  ctx.fillRect(PLAY_MIN_X, 0, PLAY_WIDTH, CANVAS_HEIGHT);

  // Draw scrolling waves (cyan dashes)
  ctx.fillStyle = '#1565C0';
  const waveCount = 12;
  for (let i = 0; i < waveCount; i++) {
    const waveX = PLAY_MIN_X + 15 + ((i * 12349.57) % (PLAY_WIDTH - 30));
    const waveY = (state.bgScrollY + i * 40) % CANVAS_HEIGHT;
    ctx.fillRect(waveX, waveY, 6, 1);
    ctx.fillRect(waveX + 3, waveY + 2, 4, 1);
  }

  // Draw deterministic islands scrolling down
  ctx.fillStyle = '#2E7D32'; // Forest green islands
  const islandCount = 3;
  for (let i = 0; i < islandCount; i++) {
    // Generate static offsets per island index
    const islandX = PLAY_MIN_X + 30 + ((i * 849.23) % (PLAY_WIDTH - 60));
    const islandY = ((state.bgScrollY * 0.7 + i * 110) % (CANVAS_HEIGHT + 60)) - 30;
    const r = 12 + (i % 2) * 6; // Island radius

    ctx.beginPath();
    ctx.arc(islandX, islandY, r, 0, Math.PI * 2);
    ctx.fill();

    // Sandy beach shore outline
    ctx.strokeStyle = '#FBC02D';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Island mountain peaks (darker green)
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.arc(islandX - 2, islandY - 2, r - 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Items (Pow / Stars)
  state.items.forEach((item) => {
    if (item.type === 'pow') {
      // Draw POW icon
      drawPixelMatrix(ctx, item.x, item.y, item.width, item.height, POW_MATRIX, '#00e5ff');
    } else {
      // Draw flashing gold star
      const flash = Math.floor(elapsedMs / 100) % 2 === 0;
      ctx.fillStyle = flash ? '#FFD700' : '#FF9100';
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.width / 2, 0, Math.PI * 2);
      ctx.fill();
      // Star core
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(item.x - 1, item.y - 1, 2, 2);
    }
  });

  // Draw Enemy planes
  state.enemies.forEach((enemy) => {
    drawEnemy(ctx, enemy);
  });

  // Draw Boss if active
  if (state.boss) {
    drawBoss(ctx, state.boss, state.stage);
  }

  // Draw Player P-38 Plane
  drawPlayerP38(ctx, state.playerX, state.playerY, state.isRolling, state.rollTimer);

  // Draw Bullets
  state.bullets.forEach((bullet) => {
    if (bullet.isEnemy) {
      // Enemy: circular glowing red plasma bullet
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bullet.x - 1, bullet.y - 1, 2, 2);
    } else {
      // Player: double yellow bullets/bars
      ctx.fillStyle = '#FFEA00';
      ctx.fillRect(bullet.x - 1.5, bullet.y - 3, 3, 7);
      // Spark tip
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bullet.x - 0.5, bullet.y - 4, 1, 2);
    }
  });

  // Draw Particles
  state.particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(
      Math.floor(p.x - p.size / 2),
      Math.floor(p.y - p.size / 2),
      p.size,
      p.size
    );
  });
  ctx.globalAlpha = 1.0; // Reset alpha

  // ==================== SIDE INSTRUMENT PANELS ====================
  // Left Panel bezel border
  ctx.fillStyle = panelBg;
  ctx.fillRect(0, 0, PLAY_MIN_X, CANVAS_HEIGHT);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, PLAY_MIN_X, CANVAS_HEIGHT);

  // Draw Flight instruments decoration
  ctx.fillStyle = textTitle;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FLIGHT', PLAY_MIN_X / 2, 20);
  ctx.fillText('INSTR.', PLAY_MIN_X / 2, 30);

  // Draw Alt Dial (spinning needle)
  const drawDial = (cx: number, cy: number, label: string, val: number, maxVal: number) => {
    // Outer circle
    ctx.strokeStyle = textLabel;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    // Dial background ticks
    ctx.fillStyle = isDark ? '#111' : '#DDD';
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();

    // Needle Angle
    const angle = (val / maxVal) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#FF3300';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 11, cy + Math.sin(angle) * 11);
    ctx.stroke();

    // Center cap
    ctx.fillStyle = textValue;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = textLabel;
    ctx.font = '5px sans-serif';
    ctx.fillText(label, cx, cy + 22);
  };

  const altVal = 1000 + Math.sin(elapsedMs / 2000) * 100;
  drawDial(PLAY_MIN_X / 2, 65, 'ALTITUDE', altVal, 2000);
  
  const speedVal = 160 + (state.isRolling ? 80 : 0) + Math.cos(elapsedMs / 1000) * 5;
  drawDial(PLAY_MIN_X / 2, 125, 'AIR SPEED', speedVal, 3000);

  // Shield HP gauge progress bar style
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('SHIELD HP', PLAY_MIN_X / 2, 178);
  ctx.fillStyle = '#000000';
  ctx.fillRect(10, 185, PLAY_MIN_X - 20, 6);
  const hpPct = Math.max(0, state.playerHp / state.playerMaxHp);
  ctx.fillStyle = hpPct > 0.45 ? '#30D158' : hpPct > 0.2 ? '#FF9800' : '#FF1744';
  ctx.fillRect(11, 186, (PLAY_MIN_X - 22) * hpPct, 4);

  // Weapon details logo
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('WEAPON', PLAY_MIN_X / 2, 225);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 6px monospace';
  let weaponText = 'SINGLE GUN';
  if (state.weaponLevel === 2) weaponText = 'TWIN CANNON';
  else if (state.weaponLevel === 3) weaponText = 'TRIPLE LASER';
  ctx.fillText(weaponText, PLAY_MIN_X / 2, 235);
  ctx.strokeStyle = state.weaponLevel >= 2 ? '#00E5FF' : '#555';
  ctx.strokeRect(10, 240, PLAY_MIN_X - 20, 10);
  ctx.fillStyle = state.weaponLevel === 3 ? '#ffea00' : state.weaponLevel === 2 ? '#00e5ff' : 'transparent';
  ctx.fillRect(12, 242, PLAY_MIN_X - 24, 6);

  // Right Panel bezel border
  ctx.fillStyle = panelBg;
  ctx.fillRect(PLAY_MAX_X, 0, PLAY_MIN_X, CANVAS_HEIGHT);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(PLAY_MAX_X, 0, PLAY_MIN_X, CANVAS_HEIGHT);

  // Draw flight logs details
  ctx.fillStyle = textTitle;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION', PLAY_MAX_X + PLAY_MIN_X / 2, 20);

  // Stage display
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 6px sans-serif';
  ctx.fillText('CURRENT STAGE', PLAY_MAX_X + PLAY_MIN_X / 2, 45);
  ctx.fillStyle = textValue;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(String(state.stage), PLAY_MAX_X + PLAY_MIN_X / 2, 65);

  // Progress to boss
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('STAGE ROUTE', PLAY_MAX_X + PLAY_MIN_X / 2, 90);
  ctx.fillStyle = '#00';
  ctx.fillRect(PLAY_MAX_X + 10, 97, PLAY_MIN_X - 20, 6);
  const routePct = Math.min(1.0, state.stageProgress / 30000);
  ctx.fillStyle = '#FF9800';
  ctx.fillRect(PLAY_MAX_X + 11, 98, (PLAY_MIN_X - 22) * routePct, 4);

  // Rolls / maneuvers remaining display
  ctx.fillStyle = textLabel;
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('LOOPS REMAINING', PLAY_MAX_X + PLAY_MIN_X / 2, 130);
  
  // Render loops remaining arrow icons
  const loopRem = state.rollsRemaining;
  ctx.fillStyle = '#00E5FF';
  for (let i = 0; i < 5; i++) {
    const lx = PLAY_MAX_X + 10 + i * 12;
    const ly = 138;
    ctx.fillStyle = i < loopRem ? '#00e5ff' : '#444';
    // Draw small curved arrow or dot for loop representation
    ctx.fillRect(lx, ly, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(lx + 2, ly + 2, 2, 2);
  }

  // Boss HP display
  if (state.boss) {
    ctx.fillStyle = '#D32F2F'; // Alert Red
    ctx.font = 'bold 6px monospace';
    ctx.fillText('BOSS INCOMING', PLAY_MAX_X + PLAY_MIN_X / 2, 175);

    // HP Bar
    ctx.fillStyle = '#000';
    ctx.fillRect(PLAY_MAX_X + 10, 185, PLAY_MIN_X - 20, 8);
    const bossHpPct = Math.max(0, state.boss.hp / state.boss.maxHp);
    ctx.fillStyle = '#FF1744';
    ctx.fillRect(PLAY_MAX_X + 11, 186, (PLAY_MIN_X - 22) * bossHpPct, 6);

    ctx.fillStyle = textValue;
    ctx.font = 'bold 5px sans-serif';
    ctx.fillText(`${state.boss.hp}/${state.boss.maxHp}`, PLAY_MAX_X + PLAY_MIN_X / 2, 204);
  } else {
    ctx.fillStyle = textLabel;
    ctx.font = 'bold 5px sans-serif';
    ctx.fillText('BOSS ACTIVE', PLAY_MAX_X + PLAY_MIN_X / 2, 175);
    ctx.fillStyle = '#333';
    ctx.font = '6px sans-serif';
    ctx.fillText('NONE', PLAY_MAX_X + PLAY_MIN_X / 2, 192);
  }

  // Controls tip
  ctx.fillStyle = textLabel;
  ctx.font = '5px sans-serif';
  ctx.fillText('A: FIRE BULLET', PLAY_MAX_X + PLAY_MIN_X / 2, 240);
  ctx.fillText('B: EVASIVE LOOP', PLAY_MAX_X + PLAY_MIN_X / 2, 252);
  ctx.fillText('D-PAD: 2D MOVE', PLAY_MAX_X + PLAY_MIN_X / 2, 264);

  // ==================== GAMEPLAY BANNER ALERTS ====================
  // Flashing Warning Banner
  if (state.bossWarningTimer > 0) {
    const flash = Math.floor(elapsedMs / 250) % 2 === 0;
    if (flash) {
      ctx.fillStyle = 'rgba(211, 47, 47, 0.85)';
      ctx.fillRect(PLAY_MIN_X, 110, PLAY_WIDTH, 50);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(PLAY_MIN_X + 5, 114, PLAY_WIDTH - 10, 42);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('WARNING! ENEMY FLAGSHIP', PLAY_MIN_X + PLAY_WIDTH / 2, 132);
      ctx.fillText('INCOMING AT SPEED!', PLAY_MIN_X + PLAY_WIDTH / 2, 147);
    }
  }

  // Stage Clear Banner
  if (state.stageClearTimer > 0) {
    ctx.fillStyle = 'rgba(46, 125, 50, 0.85)';
    ctx.fillRect(PLAY_MIN_X, 100, PLAY_WIDTH, 70);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(PLAY_MIN_X + 5, 104, PLAY_WIDTH - 10, 62);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('STAGE CLEAR!', PLAY_MIN_X + PLAY_WIDTH / 2, 125);
    
    ctx.fillStyle = '#FFEB3B';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('BONUS ACCRUED +5000', PLAY_MIN_X + PLAY_WIDTH / 2, 143);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '5px monospace';
    ctx.fillText('NEXT STAGE PREPARING...', PLAY_MIN_X + PLAY_WIDTH / 2, 158);
  }
}
