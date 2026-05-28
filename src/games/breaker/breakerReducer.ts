export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Brick {
  id: string;
  x: number; // Grid index 0..7
  y: number; // Grid index 0..5
  hp: number;
  isPowerUpBrick: boolean;
}

export interface PowerUp {
  id: string;
  x: number; // Canvas X
  y: number; // Canvas Y
  type: 'multiball' | 'wide' | 'slow';
  vy: number;
}

export interface BreakerState {
  paddleX: number;
  paddleWidth: number;
  balls: Ball[];
  bricks: Brick[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
  gameWon: boolean;
  ballLaunched: boolean;
  activePowerUps: {
    wide: number; // Remaining duration in ms
    slow: number; // Remaining duration in ms
  };
}

export type BreakerAction =
  | { type: 'RESET' }
  | { type: 'LAUNCH_BALL' }
  | { type: 'MOVE_PADDLE'; dx: number }
  | { type: 'PADDLE_TOUCH'; x: number }
  | { 
      type: 'TICK'; 
      dt: number; 
      onHitBrick?: (brick: Brick) => void;
      onHitPaddle?: () => void;
      onPowerUp?: (type: string) => void;
      onLifeLost?: () => void;
      onLevelClear?: () => void;
      onGameOver?: () => void;
    };

export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 300;
export const PADDLE_Y = 275;
export const PADDLE_HEIGHT = 8;
export const BALL_RADIUS = 3.5;
export const BRICK_COLS = 8;
export const BRICK_ROWS = 6;
export const BRICK_WIDTH = 43;
export const BRICK_HEIGHT = 10;
export const BRICK_GAP = 5;
export const BRICK_Y_OFFSET = 35;
export const BRICK_X_OFFSET = 12;

/**
 * Generates brick layouts for a specific level.
 */
export function generateBricks(level: number): Brick[] {
  const bricks: Brick[] = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      // Different brick structures based on level
      let hp = 1;
      if (level > 1 && r < 2) hp = 2; // Harder bricks at top rows for lvl 2+
      if (level > 2 && r === 0) hp = 3;

      // 10% chance to be a power-up brick
      const isPowerUpBrick = Math.random() < 0.15;

      bricks.push({
        id: `${r}-${c}`,
        x: c,
        y: r,
        hp,
        isPowerUpBrick,
      });
    }
  }
  return bricks;
}

export const INITIAL_STATE = (level = 1): BreakerState => {
  const initialPaddleWidth = 60;
  return {
    paddleX: (CANVAS_WIDTH - initialPaddleWidth) / 2,
    paddleWidth: initialPaddleWidth,
    balls: [
      {
        x: CANVAS_WIDTH / 2,
        y: PADDLE_Y - BALL_RADIUS - 1,
        vx: 0,
        vy: 0,
      },
    ],
    bricks: generateBricks(level),
    powerUps: [],
    score: 0,
    lives: 1,
    level,
    gameOver: false,
    gameWon: false,
    ballLaunched: false,
    activePowerUps: {
      wide: 0,
      slow: 0,
    },
  };
};

/**
 * breakerReducer manages physics, boundary collisions, brick destruction, and power-up states.
 */
export function breakerReducer(state: BreakerState, action: BreakerAction): BreakerState {
  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE(state.level);

    case 'LAUNCH_BALL': {
      if (state.ballLaunched || state.gameOver) return state;

      // Set initial trajectory speed (+10% velocity per level)
      const speedMultiplier = Math.min(1.8, Math.pow(1.1, state.level - 1));
      const angle = (Math.random() * 40 + 70) * (Math.PI / 180); // 70 to 110 degrees
      const baseVelocity = 3.5 * speedMultiplier;

      const vx = Math.cos(angle) * baseVelocity;
      const vy = -Math.sin(angle) * baseVelocity;

      const newBalls = state.balls.map((b) => ({
        ...b,
        vx,
        vy,
      }));

      return {
        ...state,
        balls: newBalls,
        ballLaunched: true,
      };
    }

    case 'MOVE_PADDLE': {
      if (state.gameOver) return state;
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - state.paddleWidth, state.paddleX + action.dx));
      
      // If ball is not launched, lock it to move along with the paddle
      let newBalls = [...state.balls];
      if (!state.ballLaunched && newBalls.length === 1) {
        newBalls[0].x = newX + state.paddleWidth / 2;
      }

      return {
        ...state,
        paddleX: newX,
        balls: newBalls,
      };
    }

    case 'PADDLE_TOUCH': {
      if (state.gameOver) return state;
      const newX = Math.max(0, Math.min(CANVAS_WIDTH - state.paddleWidth, action.x - state.paddleWidth / 2));
      
      let newBalls = [...state.balls];
      if (!state.ballLaunched && newBalls.length === 1) {
        newBalls[0].x = newX + state.paddleWidth / 2;
      }

      return {
        ...state,
        paddleX: newX,
        balls: newBalls,
      };
    }

    case 'TICK': {
      if (state.gameOver || state.gameWon) return state;

      const dtMs = action.dt * 1000;
      
      // 1. Tick Powerup Timers
      const wideTimer = Math.max(0, state.activePowerUps.wide - dtMs);
      const slowTimer = Math.max(0, state.activePowerUps.slow - dtMs);
      const targetPaddleWidth = wideTimer > 0 ? 90 : 60;
      
      // Handle wide paddle reset smoothly
      let currentPaddleX = state.paddleX;
      if (state.paddleWidth !== targetPaddleWidth) {
        // Center the adjustment
        const diff = targetPaddleWidth - state.paddleWidth;
        currentPaddleX = Math.max(0, Math.min(CANVAS_WIDTH - targetPaddleWidth, currentPaddleX - diff / 2));
      }

      // 2. Update Falling Powerups
      let currentPowerUps = state.powerUps
        .map((p) => ({ ...p, y: p.y + p.vy * action.dt * 60 })) // 60fps scaled
        .filter((p) => p.y < CANVAS_HEIGHT); // Remove out of bounds

      // Check power-up collections
      let wideActive = wideTimer > 0;
      let slowActive = slowTimer > 0;
      let extraBallsToSpawn: Ball[] = [];
      let newScore = state.score;

      const remainingPowerUps = currentPowerUps.filter((p) => {
        const hitPaddle =
          p.y >= PADDLE_Y &&
          p.y <= PADDLE_Y + PADDLE_HEIGHT &&
          p.x >= currentPaddleX &&
          p.x <= currentPaddleX + targetPaddleWidth;

        if (hitPaddle) {
          newScore = Math.min(99999, newScore + 50); // 50 points per powerup capsule
          if (action.onPowerUp) action.onPowerUp(p.type);

          if (p.type === 'wide') {
            wideActive = true;
          } else if (p.type === 'slow') {
            slowActive = true;
          } else if (p.type === 'multiball') {
            // Spawn 2 extra balls from active ball positions
            state.balls.forEach((b) => {
              if (extraBallsToSpawn.length < 4) {
                // Symmetrical spread trajectories
                extraBallsToSpawn.push({
                  x: b.x,
                  y: b.y,
                  vx: b.vx * 0.9 - 1.2,
                  vy: b.vy * 0.9,
                });
                extraBallsToSpawn.push({
                  x: b.x,
                  y: b.y,
                  vx: b.vx * 0.9 + 1.2,
                  vy: b.vy * 0.9,
                });
              }
            });
          }
          return false; // Remove collected powerup
        }
        return true;
      });

      // 3. Move & Check Ball Collisions
      let activeBalls = [...state.balls];
      
      // If extra balls were spawned by multi-ball
      if (extraBallsToSpawn.length > 0) {
        activeBalls = [...activeBalls, ...extraBallsToSpawn].slice(0, 3); // Max 3 balls
      }

      let currentBricks = [...state.bricks];
      let hasHitPaddle = false;

      // Adjust speed depending on slow powerup
      const speedFactor = slowActive ? 0.65 : 1.0;

      activeBalls = activeBalls.map((b) => {
        if (!state.ballLaunched) {
          // Keep lock to paddle
          return {
            ...b,
            x: currentPaddleX + targetPaddleWidth / 2,
            y: PADDLE_Y - BALL_RADIUS - 1,
          };
        }

        // Apply speed factors
        let nextX = b.x + b.vx * speedFactor * action.dt * 60;
        let nextY = b.y + b.vy * speedFactor * action.dt * 60;

        let vx = b.vx;
        let vy = b.vy;

        // Collision with Wall Borders
        if (nextX - BALL_RADIUS <= 0) {
          nextX = BALL_RADIUS;
          vx = -vx;
        } else if (nextX + BALL_RADIUS >= CANVAS_WIDTH) {
          nextX = CANVAS_WIDTH - BALL_RADIUS;
          vx = -vx;
        }

        if (nextY - BALL_RADIUS <= 0) {
          nextY = BALL_RADIUS;
          vy = -vy;
        }

        // Collision with Paddle
        if (
          vy > 0 &&
          nextY + BALL_RADIUS >= PADDLE_Y &&
          nextY - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
          nextX >= currentPaddleX &&
          nextX <= currentPaddleX + targetPaddleWidth
        ) {
          nextY = PADDLE_Y - BALL_RADIUS;
          vy = -vy;
          hasHitPaddle = true;

          // Influence ball trajectory bounce angle based on hit location relative to paddle center
          const paddleCenter = currentPaddleX + targetPaddleWidth / 2;
          const hitPos = nextX - paddleCenter;
          const normalizedHit = hitPos / (targetPaddleWidth / 2);
          
          const maxBounceAngleShift = 2.0;
          vx = vx + normalizedHit * maxBounceAngleShift;
          
          // Re-normalize magnitude
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          const speedMultiplier = Math.min(1.8, Math.pow(1.1, state.level - 1));
          const targetSpeed = 3.5 * speedMultiplier;
          const ratio = targetSpeed / currentSpeed;
          vx *= ratio;
          vy *= ratio;
        }

        // Collision with Bricks
        currentBricks = currentBricks.map((brick) => {
          if (brick.hp <= 0) return brick;

          const brickX = BRICK_X_OFFSET + brick.x * (BRICK_WIDTH + BRICK_GAP);
          const brickY = BRICK_Y_OFFSET + brick.y * (BRICK_HEIGHT + BRICK_GAP);

          // Check AABB vs Circle collision overlap
          const closestX = Math.max(brickX, Math.min(nextX, brickX + BRICK_WIDTH));
          const closestY = Math.max(brickY, Math.min(nextY, brickY + BRICK_HEIGHT));

          const distanceX = nextX - closestX;
          const distanceY = nextY - closestY;
          const distanceSquared = distanceX * distanceX + distanceY * distanceY;

          if (distanceSquared < BALL_RADIUS * BALL_RADIUS) {
            if (action.onHitBrick) action.onHitBrick(brick);

            // Refract rebound velocity depending on which side of the brick was hit
            const overlapX = BALL_RADIUS - Math.abs(distanceX);
            const overlapY = BALL_RADIUS - Math.abs(distanceY);

            if (overlapX < overlapY) {
              vx = -vx;
              nextX += distanceX > 0 ? overlapX : -overlapX;
            } else {
              vy = -vy;
              nextY += distanceY > 0 ? overlapY : -overlapY;
            }

            // Reduce brick HP
            const nextHp = brick.hp - 1;
            if (nextHp === 0) {
              // Brick destroyed
              const brickScore = brick.isPowerUpBrick ? 50 : 10;
              newScore = Math.min(99999, newScore + brickScore);

              // 10% chance to drop powerup capsule
              if (Math.random() < 0.15) {
                const types: ('multiball' | 'wide' | 'slow')[] = ['multiball', 'wide', 'slow'];
                const selectedType = types[Math.floor(Math.random() * types.length)];
                
                remainingPowerUps.push({
                  id: `pu-${Date.now()}-${Math.random()}`,
                  x: brickX + BRICK_WIDTH / 2,
                  y: brickY + BRICK_HEIGHT,
                  type: selectedType,
                  vy: 1.5,
                });
              }
            }

            return { ...brick, hp: nextHp };
          }
          return brick;
        });

        return { ...b, x: nextX, y: nextY, vx, vy };
      });

      if (hasHitPaddle && action.onHitPaddle) {
        action.onHitPaddle();
      }

      // 4. Remove Dead Balls
      const aliveBalls = activeBalls.filter((b) => b.y - BALL_RADIUS < CANVAS_HEIGHT);

      if (aliveBalls.length === 0) {
        // Lose a life
        const remainingLives = state.lives - 1;
        if (action.onLifeLost) action.onLifeLost();

        if (remainingLives <= 0) {
          if (action.onGameOver) action.onGameOver();
          return {
            ...state,
            lives: 0,
            gameOver: true,
            balls: [],
          };
        } else {
          // Reset single ball to paddle
          return {
            ...state,
            lives: remainingLives,
            balls: [
              {
                x: currentPaddleX + targetPaddleWidth / 2,
                y: PADDLE_Y - BALL_RADIUS - 1,
                vx: 0,
                vy: 0,
              },
            ],
            ballLaunched: false,
            powerUps: [], // Clear active falling items on life lost
          };
        }
      }

      // Check level clear (all bricks destroyed)
      const activeBricks = currentBricks.filter((b) => b.hp > 0);
      if (activeBricks.length === 0) {
        if (action.onLevelClear) action.onLevelClear();
        
        // Go to next level
        const nextLvl = state.level + 1;
        
        return {
          ...state,
          level: nextLvl,
          score: Math.min(99999, newScore + 1000), // 1000 points clear level bonus
          balls: [
            {
              x: currentPaddleX + targetPaddleWidth / 2,
              y: PADDLE_Y - BALL_RADIUS - 1,
              vx: 0,
              vy: 0,
            },
          ],
          bricks: generateBricks(nextLvl),
          powerUps: [],
          ballLaunched: false,
          activePowerUps: {
            wide: 0,
            slow: 0,
          },
        };
      }

      return {
        ...state,
        balls: aliveBalls,
        bricks: currentBricks,
        powerUps: remainingPowerUps,
        score: newScore,
        paddleX: currentPaddleX,
        paddleWidth: targetPaddleWidth,
        activePowerUps: {
          wide: wideActive ? (wideTimer || 10000) : 0, // Wide powerup lasts 10s
          slow: slowActive ? (slowTimer || 5000) : 0,  // Slow powerup lasts 5s
        },
      };
    }

    default:
      return state;
  }
}
