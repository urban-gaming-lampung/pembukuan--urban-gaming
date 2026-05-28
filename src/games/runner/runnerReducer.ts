export type ObstacleType = 'spike' | 'high-wall' | 'gap';

export interface Obstacle {
  id: string;
  x: number; // Canvas X
  y: number; // Canvas Y
  width: number;
  height: number;
  type: ObstacleType;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RunnerState {
  playerY: number;
  playerVY: number;
  isJumping: boolean;
  isDoubleJumping: boolean;
  isSliding: boolean;
  slideTimer: number; // ms remaining for slide
  obstacles: Obstacle[];
  coins: Coin[];
  distance: number;
  score: number;
  gameOver: boolean;
  speedMultiplier: number;
  spawnTimer: number; // ms until next obstacle
  coinSpawnTimer: number; // ms until next coin
}

export type RunnerAction =
  | { type: 'RESET' }
  | { type: 'JUMP'; onJump?: () => void }
  | { type: 'SLIDE'; onSlide?: () => void }
  | { type: 'GROUND_POUND'; onPound?: () => void }
  | {
      type: 'TICK';
      dt: number;
      onScoreCoin?: () => void;
      onGameOver?: () => void;
    };

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 300;
export const FLOOR_Y = 220; // Y line of floor
export const PLAYER_X = 50;
export const PLAYER_WIDTH = 14;
export const PLAYER_HEIGHT = 22;
export const GRAVITY = 550; // px/s^2
export const JUMP_VELOCITY = -230; // px/s
export const DOUBLE_JUMP_VELOCITY = -200; // px/s
export const SLIDE_DURATION = 650; // ms
export const BASE_SPEED = 150; // pixels per second scrolling speed

export const INITIAL_STATE = (): RunnerState => {
  return {
    playerY: FLOOR_Y - PLAYER_HEIGHT,
    playerVY: 0,
    isJumping: false,
    isDoubleJumping: false,
    isSliding: false,
    slideTimer: 0,
    obstacles: [],
    coins: [],
    distance: 0,
    score: 0,
    gameOver: false,
    speedMultiplier: 1.0,
    spawnTimer: 1500, // Spawn obstacle in 1.5s
    coinSpawnTimer: 800, // Spawn coin in 0.8s
  };
};

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

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  if (state.gameOver) {
    if (action.type === 'RESET') {
      return INITIAL_STATE();
    }
    return state;
  }

  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE();

    case 'JUMP': {
      if (state.isSliding) return state; // Can't jump while sliding

      if (!state.isJumping) {
        if (action.onJump) action.onJump();
        return {
          ...state,
          playerVY: JUMP_VELOCITY,
          isJumping: true,
          isDoubleJumping: false,
        };
      } else if (!state.isDoubleJumping) {
        if (action.onJump) action.onJump();
        return {
          ...state,
          playerVY: DOUBLE_JUMP_VELOCITY,
          isDoubleJumping: true,
        };
      }
      return state;
    }

    case 'SLIDE': {
      if (state.isJumping) return state; // Can't slide in the air (falls under ground pound logic)
      if (action.onSlide) action.onSlide();

      return {
        ...state,
        isSliding: true,
        slideTimer: SLIDE_DURATION,
      };
    }

    case 'GROUND_POUND': {
      // Ground pound drops player down fast if in mid-air
      if (state.isJumping && state.playerVY < 300) {
        if (action.onPound) action.onPound();
        return {
          ...state,
          playerVY: 350, // downward force
        };
      }
      return state;
    }

    case 'TICK': {
      const dt = action.dt;
      const dtMs = dt * 1000;

      // 1. Update slide timer
      let newSlideTimer = Math.max(0, state.slideTimer - dtMs);
      let isStillSliding = newSlideTimer > 0;

      // 2. Physics & Gravity update
      let newVY = state.playerVY + GRAVITY * dt;
      let newY = state.playerY + newVY * dt;

      let isJumping = state.isJumping;
      let isDoubleJumping = state.isDoubleJumping;

      // Ground collision
      const currentPlayerHeight = isStillSliding ? PLAYER_HEIGHT / 2 : PLAYER_HEIGHT;
      const targetFloorY = FLOOR_Y - currentPlayerHeight;

      if (newY >= targetFloorY) {
        newY = targetFloorY;
        newVY = 0;
        isJumping = false;
        isDoubleJumping = false;
      }

      // 3. Move obstacles and coins
      const currentScrollSpeed = BASE_SPEED * state.speedMultiplier;
      const movedObstacles = state.obstacles
        .map((o) => ({ ...o, x: o.x - currentScrollSpeed * dt }))
        .filter((o) => o.x > -50);

      const movedCoins = state.coins
        .map((c) => ({ ...c, x: c.x - currentScrollSpeed * dt }))
        .filter((c) => c.x > -20);

      // 4. Collision checking
      const playerBox = {
        x: PLAYER_X,
        y: newY,
        width: isStillSliding ? PLAYER_WIDTH + 8 : PLAYER_WIDTH,
        height: currentPlayerHeight,
      };

      let gameOver = false;

      // Obstacle collision
      for (const obstacle of movedObstacles) {
        // If it's a gap, the collision logic differs: player falls inside if they stand on floor and X matches
        if (obstacle.type === 'gap') {
          const inGapX = PLAYER_X + playerBox.width > obstacle.x && PLAYER_X < obstacle.x + obstacle.width;
          const onGround = newY >= FLOOR_Y - currentPlayerHeight;
          if (inGapX && onGround) {
            gameOver = true;
            break;
          }
        } else {
          // Standard AABB hit detection
          if (checkOverlap(playerBox, obstacle)) {
            gameOver = true;
            break;
          }
        }
      }

      // Coin collection collision
      let scoreGain = 0;
      const remainingCoins: Coin[] = [];

      for (const coin of movedCoins) {
        if (checkOverlap(playerBox, coin)) {
          scoreGain += 15;
          if (action.onScoreCoin) action.onScoreCoin();
        } else {
          remainingCoins.push(coin);
        }
      }

      if (gameOver) {
        if (action.onGameOver) action.onGameOver();
        return {
          ...state,
          gameOver: true,
          obstacles: movedObstacles,
          coins: remainingCoins,
        };
      }

      // 5. Spawning obstacles & coins
      let nextSpawnTimer = state.spawnTimer - dtMs;
      let finalObstacles = [...movedObstacles];

      if (nextSpawnTimer <= 0) {
        // Reset spawn timer (ranges between 1.2s to 2.4s, scaled down by speed multiplier)
        nextSpawnTimer = (1200 + Math.random() * 1200) / state.speedMultiplier;

        // Choose obstacle type: spike (ground), high-wall (requires slide), gap (requires jump)
        const rand = Math.random();
        let type: ObstacleType = 'spike';
        let ox = 420;
        let oy = FLOOR_Y - 14;
        let ow = 14;
        let oh = 14;

        if (rand < 0.35) {
          type = 'spike';
        } else if (rand < 0.7) {
          type = 'high-wall';
          oy = FLOOR_Y - 34; // floats slightly above ground so sliding goes under it
          ow = 12;
          oh = 20;
        } else {
          type = 'gap';
          oy = FLOOR_Y;
          ow = 30; // gap size
          oh = 20;
        }

        finalObstacles.push({
          id: `obstacle-${Date.now()}-${Math.random()}`,
          x: ox,
          y: oy,
          width: ow,
          height: oh,
          type,
        });
      }

      // Spawning coins
      let nextCoinSpawnTimer = state.coinSpawnTimer - dtMs;
      let finalCoins = [...remainingCoins];

      if (nextCoinSpawnTimer <= 0) {
        nextCoinSpawnTimer = (700 + Math.random() * 900) / state.speedMultiplier;

        // Spawn coin at random height
        const heightRand = Math.random();
        let cy = FLOOR_Y - 18; // standard low coin
        if (heightRand < 0.33) cy = FLOOR_Y - 45; // high jump coin
        else if (heightRand < 0.66) cy = FLOOR_Y - 32; // double jump/medium coin

        finalCoins.push({
          id: `coin-${Date.now()}-${Math.random()}`,
          x: 420,
          y: cy,
          width: 8,
          height: 8,
        });
      }

      // 6. Score & Distance tracking
      // Distance grows by scroll progress
      const newDistance = state.distance + currentScrollSpeed * dt;
      // Survival points: 5 points per second survived (approx 5 * dt)
      const distanceScore = Math.floor(newDistance / 10);
      const survivalPoints = Math.max(0, distanceScore - Math.floor(state.distance / 10));

      const totalScore = Math.min(99999, state.score + scoreGain + survivalPoints);

      // Speed increases continuously (cap multiplier at 2.2x speed)
      const newSpeedMultiplier = Math.min(2.2, 1.0 + Math.floor(totalScore / 350) * 0.12);

      return {
        ...state,
        playerY: newY,
        playerVY: newVY,
        isJumping,
        isDoubleJumping,
        isSliding: isStillSliding,
        slideTimer: newSlideTimer,
        obstacles: finalObstacles,
        coins: finalCoins,
        distance: newDistance,
        score: totalScore,
        speedMultiplier: newSpeedMultiplier,
        spawnTimer: nextSpawnTimer,
        coinSpawnTimer: nextCoinSpawnTimer,
      };
    }

    default:
      return state;
  }
}
