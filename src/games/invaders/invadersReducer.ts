export type AlienType = 'top' | 'middle' | 'bottom';

export interface Alien {
  id: string;
  x: number; // Canvas X
  y: number; // Canvas Y
  type: AlienType;
  width: number;
  height: number;
}

export interface Shot {
  id: string;
  x: number;
  y: number;
  vy: number; // velocity Y: negative is player laser, positive is alien laser
}

export interface Bunker {
  id: string;
  x: number;
  y: number;
  hp: number; // starts at 4
  width: number;
  height: number;
}

export interface UFO {
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
}

export interface InvadersState {
  playerX: number;
  playerWidth: number;
  playerHeight: number;
  shots: Shot[];
  aliens: Alien[];
  bunkers: Bunker[];
  ufo: UFO | null;
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
  gameWon: boolean;
  alienDirection: number; // 1 = right, -1 = left
  alienStepTimer: number; // ms elapsed since last alien step
  ufoSpawnTimer: number; // ms until next UFO check
  shootCooldown: number; // ms until player can shoot again
}

export type InvadersAction =
  | { type: 'RESET' }
  | { type: 'MOVE_PLAYER'; dx: number }
  | { type: 'PLAYER_TOUCH'; x: number }
  | { type: 'SHOOT'; onShoot?: () => void }
  | {
      type: 'TICK';
      dt: number;
      onHitAlien?: (type: AlienType) => void;
      onHitPlayer?: () => void;
      onHitBunker?: () => void;
      onHitUFO?: () => void;
      onLevelClear?: () => void;
      onGameOver?: () => void;
    };

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 300;
export const PLAYER_Y = 265;
export const PLAYER_HEIGHT = 10;
export const PLAYER_WIDTH = 30;

// Setup layout for aliens
export function generateAliens(level: number): Alien[] {
  const aliens: Alien[] = [];
  const rows: AlienType[] = ['top', 'middle', 'middle', 'bottom'];
  const cols = 7;
  const startX = 60;
  const startY = 45;
  const xSpacing = 38;
  const ySpacing = 22;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      aliens.push({
        id: `alien-${r}-${c}`,
        x: startX + c * xSpacing,
        y: startY + r * ySpacing,
        type: rows[r],
        width: 18,
        height: 12,
      });
    }
  }
  return aliens;
}

// Setup bunkers
export function generateBunkers(): Bunker[] {
  const bunkers: Bunker[] = [];
  const xCoords = [70, 185, 300];
  for (let i = 0; i < xCoords.length; i++) {
    bunkers.push({
      id: `bunker-${i}`,
      x: xCoords[i],
      y: 220,
      hp: 4,
      width: 28,
      height: 16,
    });
  }
  return bunkers;
}

export const INITIAL_STATE = (level = 1): InvadersState => {
  return {
    playerX: (CANVAS_WIDTH - PLAYER_WIDTH) / 2,
    playerWidth: PLAYER_WIDTH,
    playerHeight: PLAYER_HEIGHT,
    shots: [],
    aliens: generateAliens(level),
    bunkers: generateBunkers(),
    ufo: null,
    score: 0,
    lives: 3,
    level,
    gameOver: false,
    gameWon: false,
    alienDirection: 1,
    alienStepTimer: 0,
    ufoSpawnTimer: 12000, // 12 seconds check
    shootCooldown: 0,
  };
};

// Check if AABB overlaps
function checkOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

export function invadersReducer(state: InvadersState, action: InvadersAction): InvadersState {
  if (state.gameOver) {
    if (action.type === 'RESET') {
      return INITIAL_STATE(state.level);
    }
    return state;
  }

  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE(state.level);

    case 'MOVE_PLAYER': {
      const newX = Math.max(10, Math.min(CANVAS_WIDTH - state.playerWidth - 10, state.playerX + action.dx));
      return { ...state, playerX: newX };
    }

    case 'PLAYER_TOUCH': {
      const newX = Math.max(10, Math.min(CANVAS_WIDTH - state.playerWidth - 10, action.x - state.playerWidth / 2));
      return { ...state, playerX: newX };
    }

    case 'SHOOT': {
      if (state.shootCooldown > 0) return state;
      if (action.onShoot) action.onShoot();

      const newShot: Shot = {
        id: `shot-${Date.now()}-${Math.random()}`,
        x: state.playerX + state.playerWidth / 2,
        y: PLAYER_Y - 4,
        vy: -200, // moves upwards
      };

      return {
        ...state,
        shots: [...state.shots, newShot],
        shootCooldown: 400, // 400ms shoot cooldown
      };
    }

    case 'TICK': {
      const dt = action.dt;
      const dtMs = dt * 1000;

      // 1. Tick timers
      const newCooldown = Math.max(0, state.shootCooldown - dtMs);
      const newUfoSpawnTimer = Math.max(0, state.ufoSpawnTimer - dtMs);

      // 2. Move Shots
      let updatedShots = state.shots
        .map((s) => ({ ...s, y: s.y + s.vy * dt }))
        // Filter out shots leaving the canvas boundaries
        .filter((s) => s.y > 10 && s.y < CANVAS_HEIGHT - 10);

      // 3. Move UFO
      let newUfo = state.ufo;
      let scoreGain = 0;

      if (newUfo) {
        newUfo = { ...newUfo, x: newUfo.x + newUfo.vx * dt };
        // Check out of bounds
        if (newUfo.x < -40 || newUfo.x > CANVAS_WIDTH + 40) {
          newUfo = null;
        }
      }

      // Spawn UFO if timer is out
      let finalUfoSpawnTimer = newUfoSpawnTimer;
      if (newUfo === null && newUfoSpawnTimer <= 0) {
        const direction = Math.random() < 0.5 ? 1 : -1;
        newUfo = {
          x: direction === 1 ? -30 : CANVAS_WIDTH + 10,
          y: 28,
          vx: direction * 75, // speed
          width: 24,
          height: 10,
        };
        finalUfoSpawnTimer = 15000 + Math.random() * 10000; // Next check in 15-25s
      }

      // 4. Collision checking
      const remainingAliens = [...state.aliens];
      const remainingBunkers = state.bunkers.map((b) => ({ ...b }));
      let newLives = state.lives;

      const activeShots: Shot[] = [];

      for (const shot of updatedShots) {
        let shotConsumed = false;

        // Player shot (moves up: vy < 0)
        if (shot.vy < 0) {
          // Check hitting UFO
          if (newUfo && checkOverlap(
            { x: shot.x - 1, y: shot.y - 4, width: 2, height: 6 },
            newUfo
          )) {
            scoreGain += 150;
            newUfo = null;
            shotConsumed = true;
            if (action.onHitUFO) action.onHitUFO();
          }

          // Check hitting aliens
          if (!shotConsumed) {
            for (let i = 0; i < remainingAliens.length; i++) {
              const alien = remainingAliens[i];
              if (checkOverlap(
                { x: shot.x - 1, y: shot.y - 4, width: 2, height: 6 },
                alien
              )) {
                if (alien.type === 'top') scoreGain += 30;
                else if (alien.type === 'middle') scoreGain += 20;
                else scoreGain += 10;

                remainingAliens.splice(i, 1);
                shotConsumed = true;
                if (action.onHitAlien) action.onHitAlien(alien.type);
                break;
              }
            }
          }
        } else {
          // Alien shot (moves down: vy > 0)
          // Check hitting player
          if (checkOverlap(
            { x: shot.x - 1, y: shot.y, width: 2, height: 6 },
            { x: state.playerX, y: PLAYER_Y, width: state.playerWidth, height: state.playerHeight }
          )) {
            newLives--;
            shotConsumed = true;
            if (action.onHitPlayer) action.onHitPlayer();
          }
        }

        // Check hitting bunkers (both player & alien shots can damage bunkers)
        if (!shotConsumed) {
          for (let i = 0; i < remainingBunkers.length; i++) {
            const bunker = remainingBunkers[i];
            if (bunker.hp > 0 && checkOverlap(
              { x: shot.x - 1.5, y: shot.y - 3, width: 3, height: 6 },
              bunker
            )) {
              bunker.hp--;
              shotConsumed = true;
              if (action.onHitBunker) action.onHitBunker();
              break;
            }
          }
        }

        if (!shotConsumed) {
          activeShots.push(shot);
        }
      }

      const filteredBunkers = remainingBunkers.filter((b) => b.hp > 0);

      // 5. Level Clear Check
      if (remainingAliens.length === 0) {
        if (action.onLevelClear) action.onLevelClear();
        const nextLevel = state.level + 1;
        const freshState = INITIAL_STATE(nextLevel);
        return {
          ...freshState,
          score: Math.min(99999, state.score + scoreGain + 500 * state.level), // Level clear bonus!
          lives: state.lives, // carry over lives
          bunkers: state.bunkers, // carry over bunkers structure
        };
      }

      // 6. Game Over check
      if (newLives <= 0) {
        if (action.onGameOver) action.onGameOver();
        return {
          ...state,
          shots: [],
          aliens: remainingAliens,
          bunkers: filteredBunkers,
          ufo: newUfo,
          score: Math.min(99999, state.score + scoreGain),
          lives: 0,
          gameOver: true,
        };
      }

      // 7. Alien step movement loop
      let newStepTimer = state.alienStepTimer + dtMs;
      // Step interval speeds up as aliens are cleared and levels increase
      const baseInterval = Math.max(80, 800 - (state.level - 1) * 120 - (28 - remainingAliens.length) * 22);

      let finalAliens = remainingAliens.map((a) => ({ ...a }));
      let newDirection = state.alienDirection;
      let shiftDownNeeded = false;

      if (newStepTimer >= baseInterval) {
        newStepTimer = 0;

        // Check if any alien reaches borders
        for (const alien of finalAliens) {
          const nextX = alien.x + newDirection * 8;
          if (nextX <= 15 || nextX + alien.width >= CANVAS_WIDTH - 15) {
            shiftDownNeeded = true;
            break;
          }
        }

        if (shiftDownNeeded) {
          newDirection = -newDirection;
          finalAliens = finalAliens.map((a) => ({ ...a, y: a.y + 12 }));
        } else {
          finalAliens = finalAliens.map((a) => ({ ...a, x: a.x + newDirection * 8 }));
        }

        // Check if any alien reaches bunker/player zone (Y >= 210)
        const reachedDanger = finalAliens.some((a) => a.y + a.height >= PLAYER_Y - 5);
        if (reachedDanger) {
          if (action.onGameOver) action.onGameOver();
          return {
            ...state,
            aliens: finalAliens,
            bunkers: filteredBunkers,
            gameOver: true,
          };
        }

        // Alien shooting logic (chance increases with level)
        const shootChance = 0.15 + state.level * 0.05;
        if (Math.random() < shootChance) {
          // Choose alien nearest to bottom per column or randomly
          const shooterIdx = Math.floor(Math.random() * finalAliens.length);
          const shooter = finalAliens[shooterIdx];
          const alienLaser: Shot = {
            id: `shot-alien-${Date.now()}-${Math.random()}`,
            x: shooter.x + shooter.width / 2,
            y: shooter.y + shooter.height + 2,
            vy: 110 + state.level * 15, // speed scales with level
          };
          activeShots.push(alienLaser);
        }
      }

      return {
        ...state,
        shots: activeShots,
        aliens: finalAliens,
        bunkers: filteredBunkers,
        ufo: newUfo,
        score: Math.min(99999, state.score + scoreGain),
        lives: newLives,
        alienDirection: newDirection,
        alienStepTimer: newStepTimer,
        ufoSpawnTimer: finalUfoSpawnTimer,
        shootCooldown: newCooldown,
      };
    }

    default:
      return state;
  }
}
