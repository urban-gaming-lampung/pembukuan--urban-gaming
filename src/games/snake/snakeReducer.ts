export interface Point {
  x: number;
  y: number;
}

export interface SnakeState {
  snake: Point[];
  food: Point;
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  score: number;
  gameOver: boolean;
  speed: number; // Ticking rate in ms
  lastFoodTime: number; // Client relative timestamp (ms) since game start
  comboCount: number; // Number of consecutive quick eats (< 2s)
}

export type SnakeAction =
  | { type: 'MOVE'; timestamp: number; onEatFood?: () => void; onCrash?: () => void }
  | { type: 'CHANGE_DIRECTION'; direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' }
  | { type: 'RESET' };

const COLS = 20;
const ROWS = 20;

/**
 * Generates food at random coordinates that do not overlap with the snake body.
 */
export function generateFood(snake: Point[]): Point {
  let food: Point;
  let isOverlap = true;

  while (isOverlap) {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
    isOverlap = snake.some((segment) => segment.x === food.x && segment.y === food.y);
  }

  return food!;
}

export const INITIAL_STATE = (): SnakeState => {
  const initialSnake = [
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ];
  return {
    snake: initialSnake,
    food: generateFood(initialSnake),
    direction: 'UP',
    score: 0,
    gameOver: false,
    speed: 200,
    lastFoodTime: 0,
    comboCount: 0,
  };
};

/**
 * snakeReducer manages the physics and rules of the Snake game.
 */
export function snakeReducer(state: SnakeState, action: SnakeAction): SnakeState {
  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE();

    case 'CHANGE_DIRECTION': {
      const currentDir = state.direction;
      const nextDir = action.direction;

      // Prevent opposite direction movement (reversing into tail)
      if (
        (currentDir === 'UP' && nextDir === 'DOWN') ||
        (currentDir === 'DOWN' && nextDir === 'UP') ||
        (currentDir === 'LEFT' && nextDir === 'RIGHT') ||
        (currentDir === 'RIGHT' && nextDir === 'LEFT')
      ) {
        return state;
      }

      return {
        ...state,
        direction: nextDir,
      };
    }

    case 'MOVE': {
      if (state.gameOver) return state;

      const head = state.snake[0];
      let newHead = { ...head };

      switch (state.direction) {
        case 'UP':
          newHead.y -= 1;
          break;
        case 'DOWN':
          newHead.y += 1;
          break;
        case 'LEFT':
          newHead.x -= 1;
          break;
        case 'RIGHT':
          newHead.x += 1;
          break;
      }

      // Check collision with walls (Grid boundaries are 0 to COLS-1 / ROWS-1)
      if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        if (action.onCrash) action.onCrash();
        return {
          ...state,
          gameOver: true,
        };
      }

      // Check self-collision (excluding the very end of tail, which moves forward)
      const collisionBody = state.snake.slice(0, -1);
      if (collisionBody.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        if (action.onCrash) action.onCrash();
        return {
          ...state,
          gameOver: true,
        };
      }

      const newSnake = [newHead, ...state.snake];
      const isEating = newHead.x === state.food.x && newHead.y === state.food.y;

      if (isEating) {
        if (action.onEatFood) action.onEatFood();

        // Calculate score with combo multiplier
        const now = action.timestamp;
        const timeDiff = now - state.lastFoodTime;
        
        let newComboCount = 0;
        // Check if eaten within 2 seconds of the previous food
        if (state.lastFoodTime > 0 && timeDiff < 2000) {
          newComboCount = Math.min(4, state.comboCount + 1); // Cap multiplier at 5x (comboCount + 1)
        }

        const scoreGain = 10 * (newComboCount + 1);
        const newScore = Math.min(9999, state.score + scoreGain); // Cap at max score 9999

        // Speed increases as score increases (starts at 200ms, decreases 5ms per 5 points, caps at 80ms)
        const speedDecrease = Math.floor(newScore / 5) * 5;
        const newSpeed = Math.max(80, 200 - speedDecrease);

        return {
          ...state,
          snake: newSnake,
          food: generateFood(newSnake),
          score: newScore,
          speed: newSpeed,
          lastFoodTime: now,
          comboCount: newComboCount,
        };
      } else {
        // Normal move - remove tail segment
        newSnake.pop();
        return {
          ...state,
          snake: newSnake,
        };
      }
    }

    default:
      return state;
  }
}
