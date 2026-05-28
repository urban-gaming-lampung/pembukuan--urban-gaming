export type EnemyType = 'scout' | 'fighter' | 'bomber' | 'item' | 'pow';

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isEnemy: boolean;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  shootTimer: number; // ms
  scoreValue: number;
}

export interface Boss {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  shootTimer: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number; // 1 to 0
  size: number;
}

export interface Item {
  id: string;
  x: number;
  y: number;
  vy: number;
  width: number;
  height: number;
  type: 'pow' | 'star';
}

export interface StrikerState {
  playerX: number;
  playerY: number;
  playerWidth: number;
  playerHeight: number;
  bullets: Bullet[];
  enemies: Enemy[];
  boss: Boss | null;
  items: Item[];
  particles: Particle[];
  score: number;
  lives: number; // Keep for leaderboard checks
  playerHp: number;
  playerMaxHp: number;
  stage: number;
  stageProgress: number; // time played in current stage (ms)
  bossWarningTimer: number; // ms countdown
  stageClearTimer: number; // ms countdown
  isRolling: boolean;
  rollTimer: number; // ms remaining
  rollCooldown: number; // ms remaining
  rollsRemaining: number;
  weaponLevel: number; // 2 = twin, 3 = triple
  gameOver: boolean;
  gameWon: boolean;
  shootCooldown: number; // ms
  bgScrollY: number;
}

export type StrikerAction =
  | { type: 'RESET' }
  | { type: 'MOVE_PLAYER'; dx: number; dy: number }
  | { type: 'PLAYER_TOUCH'; x: number; y: number }
  | { type: 'SHOOT'; onShoot?: () => void }
  | { type: 'TRIGGER_ROLL'; onRoll?: () => void }
  | {
      type: 'TICK';
      dt: number;
      onScoreItem?: () => void;
      onHitEnemy?: () => void;
      onBossHit?: () => void;
      onHitPlayer?: () => void;
      onGameOver?: () => void;
      onStageClear?: () => void;
      onBossSpawn?: () => void;
      onGameWon?: () => void;
    };

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 300;

export const PLAY_MIN_X = 80;
export const PLAY_MAX_X = 320;
export const PLAY_WIDTH = PLAY_MAX_X - PLAY_MIN_X;

export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 18;

// Stage length before boss triggers (30 seconds)
export const STAGE_LENGTH_MS = 30000;
export const BOSS_WARNING_DURATION_MS = 3000;
export const STAGE_CLEAR_DURATION_MS = 4000;

export const INITIAL_STATE = (): StrikerState => {
  return {
    playerX: (PLAY_MIN_X + PLAY_MAX_X) / 2,
    playerY: CANVAS_HEIGHT - 50,
    playerWidth: PLAYER_WIDTH,
    playerHeight: PLAYER_HEIGHT,
    bullets: [],
    enemies: [],
    boss: null,
    items: [],
    particles: [],
    score: 0,
    lives: 1, // Keep as 1 (triggers gameover at lives: 0)
    playerHp: 100,
    playerMaxHp: 100,
    stage: 1,
    stageProgress: 0,
    bossWarningTimer: 0,
    stageClearTimer: 0,
    isRolling: false,
    rollTimer: 0,
    rollCooldown: 0,
    rollsRemaining: 3,
    weaponLevel: 2, // Starts as twin cannon (OP feeling)
    gameOver: false,
    gameWon: false,
    shootCooldown: 0,
    bgScrollY: 0,
  };
};

function checkOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    r1.x - r1.width / 2 < r2.x + r2.width / 2 &&
    r1.x + r1.width / 2 > r2.x - r2.width / 2 &&
    r1.y - r1.height / 2 < r2.y + r2.height / 2 &&
    r1.y + r1.height / 2 > r2.y - r2.height / 2
  );
}

function spawnExplosion(particles: Particle[], x: number, y: number, count = 8, color = '#ff8800') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 80;
    particles.push({
      id: `part-${Date.now()}-${Math.random()}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1.0,
      size: 2 + Math.random() * 4,
    });
  }
}

export function strikerReducer(state: StrikerState, action: StrikerAction): StrikerState {
  if (state.gameOver) {
    if (action.type === 'RESET') {
      return INITIAL_STATE();
    }
    return state;
  }

  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE();

    case 'MOVE_PLAYER': {
      if (state.isRolling) return state; // Disable moving adjustments during loops
      const newX = Math.max(PLAY_MIN_X + PLAYER_WIDTH / 2 + 5, Math.min(PLAY_MAX_X - PLAYER_WIDTH / 2 - 5, state.playerX + action.dx));
      const newY = Math.max(40, Math.min(CANVAS_HEIGHT - PLAYER_HEIGHT / 2 - 10, state.playerY + action.dy));
      return { ...state, playerX: newX, playerY: newY };
    }

    case 'PLAYER_TOUCH': {
      if (state.isRolling) return state;
      const newX = Math.max(PLAY_MIN_X + PLAYER_WIDTH / 2 + 5, Math.min(PLAY_MAX_X - PLAYER_WIDTH / 2 - 5, action.x));
      const newY = Math.max(40, Math.min(CANVAS_HEIGHT - PLAYER_HEIGHT / 2 - 10, action.y));
      return { ...state, playerX: newX, playerY: newY };
    }

    case 'SHOOT': {
      if (state.isRolling || state.shootCooldown > 0) return state;
      if (action.onShoot) action.onShoot();

      const newBullets: Bullet[] = [];
      if (state.weaponLevel === 1) {
        newBullets.push({
          id: `pbullet-${Date.now()}-1`,
          x: state.playerX,
          y: state.playerY - 8,
          vx: 0,
          vy: -340,
          isEnemy: false,
        });
      } else if (state.weaponLevel === 2) {
        newBullets.push(
          {
            id: `pbullet-${Date.now()}-1`,
            x: state.playerX - 6,
            y: state.playerY - 6,
            vx: 0,
            vy: -340,
            isEnemy: false,
          },
          {
            id: `pbullet-${Date.now()}-2`,
            x: state.playerX + 6,
            y: state.playerY - 6,
            vx: 0,
            vy: -340,
            isEnemy: false,
          }
        );
      } else {
        // Triple shots (OP weapon level 3)
        newBullets.push(
          {
            id: `pbullet-${Date.now()}-1`,
            x: state.playerX,
            y: state.playerY - 8,
            vx: 0,
            vy: -340,
            isEnemy: false,
          },
          {
            id: `pbullet-${Date.now()}-2`,
            x: state.playerX - 6,
            y: state.playerY - 6,
            vx: -70,
            vy: -330,
            isEnemy: false,
          },
          {
            id: `pbullet-${Date.now()}-3`,
            x: state.playerX + 6,
            y: state.playerY - 6,
            vx: 70,
            vy: -330,
            isEnemy: false,
          }
        );
      }

      return {
        ...state,
        bullets: [...state.bullets, ...newBullets],
        shootCooldown: 150, // 150ms shoot cooldown (OP and fast!)
      };
    }

    case 'TRIGGER_ROLL': {
      if (state.isRolling || state.rollCooldown > 0 || state.rollsRemaining <= 0) return state;
      if (action.onRoll) action.onRoll();

      return {
        ...state,
        isRolling: true,
        rollTimer: 1000, // 1 second loop duration
        rollCooldown: 3000, // 3 seconds cooldown
        rollsRemaining: state.rollsRemaining - 1,
      };
    }

    case 'TICK': {
      const dt = action.dt;
      const dtMs = dt * 1000;
      let scoreGain = 0;

      // 1. Timers & background scrolling
      const newShootCooldown = Math.max(0, state.shootCooldown - dtMs);
      const newRollCooldown = Math.max(0, state.rollCooldown - dtMs);
      let isRolling = state.isRolling;
      let newRollTimer = state.rollTimer;

      if (isRolling) {
        newRollTimer = Math.max(0, state.rollTimer - dtMs);
        if (newRollTimer <= 0) {
          isRolling = false;
        }
      }

      const newBgScrollY = (state.bgScrollY + 40 * dt) % CANVAS_HEIGHT;

      // Stage timers
      let newStageProgress = state.stageProgress;
      let newBossWarningTimer = state.bossWarningTimer;
      let newStageClearTimer = state.stageClearTimer;
      let boss = state.boss;
      let currentStage = state.stage;
      let gameWon: boolean = state.gameWon;
      let gameOver: boolean = state.gameOver;

      if (newStageClearTimer > 0) {
        newStageClearTimer = Math.max(0, newStageClearTimer - dtMs);
        if (newStageClearTimer <= 0) {
          // Progress to next stage
          if (currentStage >= 3) {
            gameWon = true;
            gameOver = true;
            if (action.onGameWon) action.onGameWon();
          } else {
            currentStage += 1;
            newStageProgress = 0;
            return {
              ...state,
              stage: currentStage,
              stageProgress: 0,
              boss: null,
              bullets: [],
              enemies: [],
              items: [],
              playerHp: 100, // Fully heal player on stage clear
              rollsRemaining: Math.min(5, state.rollsRemaining + 3), // Grant +3 rolls, capped at 5
              stageClearTimer: 0,
            };
          }
        }
      } else if (newBossWarningTimer > 0) {
        newBossWarningTimer = Math.max(0, newBossWarningTimer - dtMs);
        if (newBossWarningTimer <= 0) {
          // Spawn Boss
          if (action.onBossSpawn) action.onBossSpawn();
          if (currentStage === 1) {
            boss = {
              name: 'BOMBER KAI',
              x: (PLAY_MIN_X + PLAY_MAX_X) / 2,
              y: -40,
              vx: 50,
              vy: 30,
              width: 55,
              height: 28,
              hp: 40, // lower hp for Stage 1 (OP feeling)
              maxHp: 40,
              shootTimer: 1000,
            };
          } else if (currentStage === 2) {
            boss = {
              name: 'NAGATO HULL',
              x: (PLAY_MIN_X + PLAY_MAX_X) / 2,
              y: -50,
              vx: 40,
              vy: 20,
              width: 70,
              height: 36,
              hp: 90,
              maxHp: 90,
              shootTimer: 1200,
            };
          } else {
            boss = {
              name: 'AYAKO B-29',
              x: (PLAY_MIN_X + PLAY_MAX_X) / 2,
              y: -60,
              vx: 70,
              vy: 25,
              width: 85,
              height: 38,
              hp: 220, // tough boss for Stage 3
              maxHp: 220,
              shootTimer: 800,
            };
          }
        }
      } else if (boss === null) {
        newStageProgress += dtMs;
        if (newStageProgress >= STAGE_LENGTH_MS) {
          // Trigger boss incoming warning
          newBossWarningTimer = BOSS_WARNING_DURATION_MS;
        }
      }

      // 2. Move & Update Particles
      const nextParticles = state.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          life: p.life - 1.8 * dt,
        }))
        .filter((p) => p.life > 0);

      // 3. Move & Update Bullets
      let finalBullets = state.bullets
        .map((b) => ({
          ...b,
          x: b.x + b.vx * dt,
          y: b.y + b.vy * dt,
        }))
        .filter((b) => b.x >= PLAY_MIN_X - 10 && b.x <= PLAY_MAX_X + 10 && b.y >= -20 && b.y <= CANVAS_HEIGHT + 20);

      // 4. Move & Update Items
      const nextItems = state.items
        .map((it) => ({
          ...it,
          y: it.y + it.vy * dt,
        }))
        .filter((it) => it.y < CANVAS_HEIGHT + 10);

      // 5. Move & Update Enemies
      let nextEnemies = state.enemies
        .map((e) => {
          let nvx = e.vx;
          let nvy = e.vy;

          if (e.type === 'fighter') {
            nvx = Math.sin(state.bgScrollY * 0.08) * 120;
          }

          return {
            ...e,
            x: e.x + nvx * dt,
            y: e.y + nvy * dt,
            shootTimer: e.shootTimer > 0 ? e.shootTimer - dtMs : 0,
          };
        })
        .filter((e) => e.y < CANVAS_HEIGHT + 20); // Removed X filter bounds so swoop planes don't bug out

      // Enemy shooting logic
      const addedBullets: Bullet[] = [];
      nextEnemies = nextEnemies.map((e) => {
        if (e.shootTimer <= 0 && e.type !== 'pow' && e.type !== 'item') {
          let timerReset = 1500 + Math.random() * 2000;
          if (e.type === 'bomber') {
            timerReset = 2000 + Math.random() * 1500;
            addedBullets.push(
              {
                id: `ebullet-${Date.now()}-${Math.random()}`,
                x: e.x,
                y: e.y + e.height / 2,
                vx: -30,
                vy: 110,
                isEnemy: true,
              },
              {
                id: `ebullet-${Date.now()}-${Math.random()}`,
                x: e.x,
                y: e.y + e.height / 2,
                vx: 0,
                vy: 120,
                isEnemy: true,
              },
              {
                id: `ebullet-${Date.now()}-${Math.random()}`,
                x: e.x,
                y: e.y + e.height / 2,
                vx: 30,
                vy: 110,
                isEnemy: true,
              }
            );
          } else {
            // Small plane shoots single aimed bullet or straight bullet
            const angle = Math.atan2(state.playerY - e.y, state.playerX - e.x);
            const bulletSpeed = 70 + currentStage * 25; // slower bullets at stage 1, fast at stage 3
            addedBullets.push({
              id: `ebullet-${Date.now()}-${Math.random()}`,
              x: e.x,
              y: e.y + e.height / 2,
              vx: Math.cos(angle) * bulletSpeed,
              vy: Math.sin(angle) * bulletSpeed,
              isEnemy: true,
            });
          }

          return { ...e, shootTimer: timerReset };
        }
        return e;
      });

      // 6. Update Boss if active
      if (boss) {
        if (boss.hp <= 0) {
          scoreGain += 5000;
          spawnExplosion(nextParticles, boss.x, boss.y, 30, '#ffcc00');
          boss = null;
          newStageClearTimer = STAGE_CLEAR_DURATION_MS;
          if (action.onStageClear) action.onStageClear();
        } else {
          let nby = boss.y;
          let nbx = boss.x;
          let nbvx = boss.vx;

          if (boss.y < 50) {
            nby += boss.vy * dt;
          } else {
            nbx += boss.vx * dt;
            if (nbx < PLAY_MIN_X + boss.width / 2 + 10) {
              nbx = PLAY_MIN_X + boss.width / 2 + 10;
              nbvx = Math.abs(boss.vx);
            } else if (nbx > PLAY_MAX_X - boss.width / 2 - 10) {
              nbx = PLAY_MAX_X - boss.width / 2 - 10;
              nbvx = -Math.abs(boss.vx);
            }
          }

          let bShootTimer = boss.shootTimer - dtMs;
          if (bShootTimer <= 0) {
            bShootTimer = 1000 - currentStage * 150;

            if (currentStage === 1) {
              for (let i = -2; i <= 2; i++) {
                addedBullets.push({
                  id: `bbullet-${Date.now()}-${Math.random()}`,
                  x: nbx + i * 8,
                  y: nby + boss.height / 2,
                  vx: i * 25,
                  vy: 120,
                  isEnemy: true,
                });
              }
            } else if (currentStage === 2) {
              for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                addedBullets.push({
                  id: `bbullet-${Date.now()}-${Math.random()}`,
                  x: nbx,
                  y: nby + boss.height / 2,
                  vx: Math.cos(angle) * 110,
                  vy: Math.sin(angle) * 110,
                  isEnemy: true,
                });
              }
            } else {
              // Ayako
              for (let i = -2; i <= 2; i++) {
                addedBullets.push({
                  id: `bbullet-${Date.now()}-${Math.random()}`,
                  x: nbx + i * 12,
                  y: nby + boss.height / 2,
                  vx: i * 30,
                  vy: 130,
                  isEnemy: true,
                });
              }
              const angleL = Math.atan2(state.playerY - nby, state.playerX - (nbx - 20));
              const angleR = Math.atan2(state.playerY - nby, state.playerX - (nbx + 20));
              addedBullets.push(
                {
                  id: `bbullet-${Date.now()}-${Math.random()}`,
                  x: nbx - 20,
                  y: nby + boss.height / 2,
                  vx: Math.cos(angleL) * 160,
                  vy: Math.sin(angleL) * 160,
                  isEnemy: true,
                },
                {
                  id: `bbullet-${Date.now()}-${Math.random()}`,
                  x: nbx + 20,
                  y: nby + boss.height / 2,
                  vx: Math.cos(angleR) * 160,
                  vy: Math.sin(angleR) * 160,
                  isEnemy: true,
                }
              );
            }
          }

          boss = {
            ...boss,
            x: nbx,
            y: nby,
            vx: nbvx,
            shootTimer: bShootTimer,
          };
        }
      }

      // 7. Spawning waves of normal enemies
      let nextEnemiesSpawned = [...nextEnemies];
      const activeEnemiesCount = nextEnemiesSpawned.filter(e => e.type !== 'item' && e.type !== 'pow').length;

      if (boss === null && newBossWarningTimer <= 0 && newStageClearTimer <= 0 && activeEnemiesCount < 4) {
        // Difficulty scaling for spawns: easy at Stage 1, hard at Stage 3
        const spawnChance = 0.015 + currentStage * 0.015;
        if (Math.random() < spawnChance) {
          const typeRand = Math.random();
          let type: EnemyType = 'scout';
          let hp = 1;
          let w = 16;
          let h = 14;
          let vy = 60 + currentStage * 15;
          let vx = 0;
          let scoreVal = 100;

          if (typeRand < 0.5) {
            type = 'scout';
            hp = currentStage === 3 ? 2 : 1;
            vx = (Math.random() - 0.5) * (20 + currentStage * 20);
          } else if (typeRand < 0.8) {
            type = 'fighter';
            hp = currentStage === 1 ? 1 : currentStage === 2 ? 2 : 3;
            vy = 90 + currentStage * 15;
            w = 18;
            h = 16;
            scoreVal = 200;
          } else {
            type = 'bomber';
            hp = currentStage === 1 ? 4 : currentStage === 2 ? 8 : 12;
            vy = 35 + currentStage * 5;
            w = 32;
            h = 24;
            scoreVal = 500;
          }

          if (Math.random() < 0.12) {
            type = 'pow';
            hp = currentStage === 1 ? 1 : 2;
            vy = 75;
            w = 18;
            h = 16;
            scoreVal = 300;
          }

          nextEnemiesSpawned.push({
            id: `enemy-${Date.now()}-${Math.random()}`,
            type,
            x: PLAY_MIN_X + w / 2 + Math.random() * (PLAY_WIDTH - w),
            y: -20,
            vx,
            vy,
            width: w,
            height: h,
            hp,
            maxHp: hp,
            shootTimer: 500 + Math.random() * 1500,
            scoreValue: scoreVal,
          });
        }
      }

      // 8. Collisions Processing
      let finalBulletsAfterCollide: Bullet[] = [];
      let finalItems = [...nextItems];

      // Process bullet hits
      for (const bullet of [...finalBullets, ...addedBullets]) {
        let bulletDestroyed = false;

        if (!bullet.isEnemy) {
          // Player bullet hitting enemies
          for (let i = 0; i < nextEnemiesSpawned.length; i++) {
            const enemy = nextEnemiesSpawned[i];
            if (
              checkOverlap(
                { x: bullet.x, y: bullet.y, width: 10, height: 24 }, // enlarged box prevents tunneling
                { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height }
              )
            ) {
              bulletDestroyed = true;
              enemy.hp -= 1;
              if (action.onHitEnemy) action.onHitEnemy();

              if (enemy.hp <= 0) {
                scoreGain += enemy.scoreValue;
                spawnExplosion(nextParticles, enemy.x, enemy.y, enemy.type === 'bomber' ? 12 : 6);
                
                if (enemy.type === 'pow') {
                  finalItems.push({
                    id: `item-${Date.now()}-${Math.random()}`,
                    x: enemy.x,
                    y: enemy.y,
                    vy: 60,
                    width: 14,
                    height: 14,
                    type: 'pow',
                  });
                } else if (Math.random() < 0.25) {
                  finalItems.push({
                    id: `item-${Date.now()}-${Math.random()}`,
                    x: enemy.x,
                    y: enemy.y,
                    vy: 60,
                    width: 12,
                    height: 12,
                    type: 'star',
                  });
                }
                nextEnemiesSpawned.splice(i, 1);
                i--;
              } else {
                nextParticles.push({
                  id: `p-${Date.now()}-${Math.random()}`,
                  x: bullet.x,
                  y: bullet.y - 4,
                  vx: (Math.random() - 0.5) * 20,
                  vy: -10 - Math.random() * 20,
                  color: '#ffffff',
                  life: 0.3,
                  size: 2,
                });
              }
              break;
            }
          }

          // Player bullet hitting boss
          if (!bulletDestroyed && boss && boss.y > 0) {
            if (
              checkOverlap(
                { x: bullet.x, y: bullet.y, width: 10, height: 24 },
                { x: boss.x, y: boss.y, width: boss.width, height: boss.height }
              )
            ) {
              bulletDestroyed = true;
              boss.hp -= 1;
              if (action.onBossHit) action.onBossHit();

              nextParticles.push({
                id: `p-${Date.now()}-${Math.random()}`,
                x: bullet.x,
                y: bullet.y - 4,
                vx: (Math.random() - 0.5) * 30,
                vy: -20 - Math.random() * 30,
                color: '#ffffff',
                life: 0.3,
                size: 2,
              });

              if (boss.hp <= 0) {
                scoreGain += 5000;
                spawnExplosion(nextParticles, boss.x, boss.y, 30, '#ffcc00');
                boss = null;
                newStageClearTimer = STAGE_CLEAR_DURATION_MS;
                if (action.onStageClear) action.onStageClear();
              }
            }
          }
        }

        if (!bulletDestroyed) {
          finalBulletsAfterCollide.push(bullet);
        }
      }

      // Check player damage hits (if not rolling and stage is not clear)
      let playerHit = false;
      let damageTaken = 0;
      const playerBox = { x: state.playerX, y: state.playerY, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };

      if (!isRolling && newStageClearTimer <= 0) {
        // 1. Enemy bullets hit player
        for (const bullet of finalBulletsAfterCollide) {
          if (bullet.isEnemy) {
            if (
              checkOverlap(
                { x: bullet.x, y: bullet.y, width: 4, height: 4 },
                playerBox
              )
            ) {
              playerHit = true;
              // Filter out the hitting bullet to avoid double-ticks
              finalBulletsAfterCollide = finalBulletsAfterCollide.filter(b => b.id !== bullet.id);
              damageTaken += currentStage === 1 ? 8 : currentStage === 2 ? 14 : 20;
              break;
            }
          }
        }

        // 2. Enemy planes crash into player
        if (damageTaken === 0) {
          for (let i = 0; i < nextEnemiesSpawned.length; i++) {
            const enemy = nextEnemiesSpawned[i];
            if (
              checkOverlap(
                { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height },
                playerBox
              )
            ) {
              playerHit = true;
              spawnExplosion(nextParticles, enemy.x, enemy.y, enemy.type === 'bomber' ? 12 : 6);
              nextEnemiesSpawned.splice(i, 1);
              damageTaken += currentStage === 1 ? 15 : currentStage === 2 ? 25 : 35;
              break;
            }
          }
        }

        // 3. Boss crashes into player
        if (damageTaken === 0 && boss && boss.y > 0) {
          if (
            checkOverlap(
              { x: boss.x, y: boss.y, width: boss.width, height: boss.height },
              playerBox
            )
          ) {
            playerHit = true;
            damageTaken += 30;
          }
        }
      }

      // 9. Collect items (Pow/Star) - Stars heal +10 HP, Pow heals +20 HP
      let nextWeaponLevel = state.weaponLevel;
      let nextRollsRemaining = state.rollsRemaining;
      let nextPlayerHp = state.playerHp;

      for (const item of finalItems) {
        if (
          checkOverlap(
            { x: item.x, y: item.y, width: item.width, height: item.height },
            playerBox
          )
        ) {
          if (action.onScoreItem) action.onScoreItem();
          if (item.type === 'pow') {
            nextWeaponLevel = 3; // twin -> triple
            scoreGain += 500;
            nextPlayerHp = Math.min(100, nextPlayerHp + 20);
          } else {
            scoreGain += 300;
            nextPlayerHp = Math.min(100, nextPlayerHp + 10);
            if (Math.random() < 0.4) {
              nextRollsRemaining = Math.min(5, nextRollsRemaining + 1);
            }
          }
          spawnExplosion(nextParticles, item.x, item.y, 8, item.type === 'pow' ? '#00e5ff' : '#ffd700');
          finalItems = finalItems.filter((it) => it.id !== item.id);
        }
      }

      // Handle player hit damage
      if (playerHit && damageTaken > 0) {
        const nextHp = Math.max(0, nextPlayerHp - damageTaken);
        
        if (action.onHitPlayer) action.onHitPlayer();

        if (nextHp <= 0) {
          spawnExplosion(nextParticles, state.playerX, state.playerY, 24, '#ff3300');
          if (action.onGameOver) action.onGameOver();

          return {
            ...state,
            playerHp: 0,
            lives: 0,
            gameOver: true,
            bullets: [],
            enemies: [],
            items: [],
            particles: nextParticles,
            score: Math.min(99999, state.score + scoreGain),
          };
        } else {
          // Spark shield effects on non-lethal hit
          for (let i = 0; i < 4; i++) {
            nextParticles.push({
              id: `p-shield-${Date.now()}-${Math.random()}`,
              x: state.playerX + (Math.random() - 0.5) * 16,
              y: state.playerY + (Math.random() - 0.5) * 16,
              vx: (Math.random() - 0.5) * 50,
              vy: (Math.random() - 0.5) * 50,
              color: '#00e5ff',
              life: 0.4,
              size: 2,
            });
          }

          return {
            ...state,
            playerHp: nextHp,
            bullets: finalBulletsAfterCollide,
            enemies: nextEnemiesSpawned,
            items: finalItems,
            particles: nextParticles,
            score: Math.min(99999, state.score + scoreGain),
          };
        }
      }

      const totalScore = Math.min(99999, state.score + scoreGain);

      return {
        ...state,
        bullets: finalBulletsAfterCollide,
        enemies: nextEnemiesSpawned,
        boss,
        items: finalItems,
        particles: nextParticles,
        score: totalScore,
        stage: currentStage,
        stageProgress: newStageProgress,
        bossWarningTimer: newBossWarningTimer,
        stageClearTimer: newStageClearTimer,
        isRolling,
        rollTimer: newRollTimer,
        rollCooldown: newRollCooldown,
        rollsRemaining: nextRollsRemaining,
        weaponLevel: nextWeaponLevel,
        playerHp: nextPlayerHp,
        gameWon,
        gameOver,
        shootCooldown: newShootCooldown,
        bgScrollY: newBgScrollY,
      };
    }

    default:
      return state;
  }
}
