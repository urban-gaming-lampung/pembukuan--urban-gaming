export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Tetromino {
  matrix: number[][];
  type: TetrominoType;
  color: string;
  x: number;
  y: number;
}

export interface StackState {
  board: (string | null)[][]; // 20 rows x 10 cols
  currentPiece: Tetromino;
  nextPiece: Omit<Tetromino, 'x' | 'y'>;
  holdPiece: Omit<Tetromino, 'x' | 'y'> | null;
  hasHeld: boolean;
  bag: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  speed: number; // Interval in ms
}

export type StackAction =
  | { type: 'RESET' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_DOWN'; onLineClear?: (count: number) => void; onLock?: () => void; onGameOver?: () => void }
  | { type: 'ROTATE' }
  | { type: 'HARD_DROP'; onLineClear?: (count: number) => void; onLock?: () => void; onGameOver?: () => void }
  | { type: 'HOLD' };

export const COLS = 10;
export const ROWS = 20;

export const TETROMINOES: Record<TetrominoType, { matrix: number[][]; color: string }> = {
  I: {
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: '#0A84FF', // Apple Blue
  },
  O: {
    matrix: [
      [1, 1],
      [1, 1],
    ],
    color: '#FFD60A', // Apple Yellow
  },
  T: {
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#BF5AF2', // Apple Purple
  },
  S: {
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: '#30D158', // Apple Green
  },
  Z: {
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: '#FF453A', // Apple Red
  },
  J: {
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#5E5CE6', // Apple Indigo
  },
  L: {
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#FF9F0A', // Apple Orange
  },
};

// Shuffles an array in place
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generates a new shuffled bag of 7 tetrominoes
export function generateBag(): TetrominoType[] {
  return shuffle<TetrominoType>(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
}

// Rotates a matrix clockwise
export function rotateMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[c][n - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

// Checks if a piece collides with the board or boundary
export function checkCollision(
  piece: { matrix: number[][]; x: number; y: number },
  board: (string | null)[][]
): boolean {
  const matrix = piece.matrix;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] !== 0) {
        const boardX = piece.x + c;
        const boardY = piece.y + r;

        // Boundary checks
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }

        // Only check block collision if it's within board height range
        if (boardY >= 0 && board[boardY][boardX] !== null) {
          return true;
        }
      }
    }
  }
  return false;
}

// Finds the initial Y spawn position to avoid spawning out-of-bounds or inside blocks
function getInitialSpawnX(type: TetrominoType): number {
  if (type === 'O') return 4;
  return 3;
}

export const INITIAL_STATE = (): StackState => {
  let bag = generateBag();
  const firstType = bag.pop()!;
  const secondType = bag.pop()!;

  const currentPiece: Tetromino = {
    type: firstType,
    matrix: TETROMINOES[firstType].matrix,
    color: TETROMINOES[firstType].color,
    x: getInitialSpawnX(firstType),
    y: firstType === 'I' ? -1 : 0,
  };

  const nextPiece: Omit<Tetromino, 'x' | 'y'> = {
    type: secondType,
    matrix: TETROMINOES[secondType].matrix,
    color: TETROMINOES[secondType].color,
  };

  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  return {
    board,
    currentPiece,
    nextPiece,
    holdPiece: null,
    hasHeld: false,
    bag,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    speed: 800,
  };
};

export function stackReducer(state: StackState, action: StackAction): StackState {
  if (state.gameOver) {
    if (action.type === 'RESET') {
      return INITIAL_STATE();
    }
    return state;
  }

  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE();

    case 'MOVE_LEFT': {
      const moved = { ...state.currentPiece, x: state.currentPiece.x - 1 };
      if (!checkCollision(moved, state.board)) {
        return { ...state, currentPiece: moved };
      }
      return state;
    }

    case 'MOVE_RIGHT': {
      const moved = { ...state.currentPiece, x: state.currentPiece.x + 1 };
      if (!checkCollision(moved, state.board)) {
        return { ...state, currentPiece: moved };
      }
      return state;
    }

    case 'MOVE_DOWN': {
      const moved = { ...state.currentPiece, y: state.currentPiece.y + 1 };
      if (!checkCollision(moved, state.board)) {
        return { ...state, currentPiece: moved };
      }

      // If collision occurs on moving down, lock the piece in place
      if (action.onLock) action.onLock();
      
      const newBoard = state.board.map((row) => [...row]);
      const matrix = state.currentPiece.matrix;
      const px = state.currentPiece.x;
      const py = state.currentPiece.y;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const by = py + r;
            const bx = px + c;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
              newBoard[by][bx] = state.currentPiece.color;
            }
          }
        }
      }

      // Check line clears
      let clearedRowsCount = 0;
      const clearedBoard = newBoard.filter((row) => {
        const isFull = row.every((cell) => cell !== null);
        if (isFull) clearedRowsCount++;
        return !isFull;
      });

      // Insert empty rows at the top
      while (clearedBoard.length < ROWS) {
        clearedBoard.unshift(Array(COLS).fill(null));
      }

      if (clearedRowsCount > 0 && action.onLineClear) {
        action.onLineClear(clearedRowsCount);
      }

      // Score points based on cleared lines
      // 1 line: 100, 2 lines: 300, 3 lines: 500, 4 lines: 800
      let scoreGain = 0;
      if (clearedRowsCount === 1) scoreGain = 100;
      else if (clearedRowsCount === 2) scoreGain = 300;
      else if (clearedRowsCount === 3) scoreGain = 500;
      else if (clearedRowsCount === 4) scoreGain = 800;

      const newLines = state.lines + clearedRowsCount;
      const newLevel = Math.floor(newLines / 10) + 1;
      const finalScoreGain = scoreGain * newLevel;
      const newScore = Math.min(999, state.score + finalScoreGain); // Cap score at 999 as per MAX_SCORE_CAP.stack

      // Speed scale down: 800ms -> decreases by 70ms per level, minimum 100ms
      const newSpeed = Math.max(100, 800 - (newLevel - 1) * 70);

      // Spawn next piece
      let currentBag = [...state.bag];
      if (currentBag.length < 2) {
        currentBag = [...currentBag, ...generateBag()];
      }

      const nextType = currentBag.pop()!;
      const spawnedPiece: Tetromino = {
        type: state.nextPiece.type,
        matrix: state.nextPiece.matrix,
        color: state.nextPiece.color,
        x: getInitialSpawnX(state.nextPiece.type),
        y: state.nextPiece.type === 'I' ? -1 : 0,
      };

      const newNextPiece: Omit<Tetromino, 'x' | 'y'> = {
        type: nextType,
        matrix: TETROMINOES[nextType].matrix,
        color: TETROMINOES[nextType].color,
      };

      // Check if spawned piece collides instantly (Game Over)
      if (checkCollision(spawnedPiece, clearedBoard)) {
        if (action.onGameOver) action.onGameOver();
        return {
          ...state,
          board: clearedBoard,
          gameOver: true,
          score: newScore,
        };
      }

      return {
        ...state,
        board: clearedBoard,
        currentPiece: spawnedPiece,
        nextPiece: newNextPiece,
        hasHeld: false,
        bag: currentBag,
        score: newScore,
        lines: newLines,
        level: newLevel,
        speed: newSpeed,
      };
    }

    case 'ROTATE': {
      const rotatedMatrix = rotateMatrix(state.currentPiece.matrix);
      const basePiece = { ...state.currentPiece, matrix: rotatedMatrix };

      // Wall-kick offsets to test in sequence
      const kicks = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
      ];

      for (const [ox, oy] of kicks) {
        const testPiece = { ...basePiece, x: basePiece.x + ox, y: basePiece.y + oy };
        if (!checkCollision(testPiece, state.board)) {
          return { ...state, currentPiece: testPiece };
        }
      }
      return state; // Revert rotation if no kick works
    }

    case 'HARD_DROP': {
      let dropDistance = 0;
      let testPiece = { ...state.currentPiece };

      while (!checkCollision({ ...testPiece, y: testPiece.y + 1 }, state.board)) {
        testPiece.y += 1;
        dropDistance++;
      }

      // Lock current piece at the dropped coordinates
      if (action.onLock) action.onLock();

      const newBoard = state.board.map((row) => [...row]);
      const matrix = testPiece.matrix;
      const px = testPiece.x;
      const py = testPiece.y;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const by = py + r;
            const bx = px + c;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
              newBoard[by][bx] = testPiece.color;
            }
          }
        }
      }

      // Check line clears
      let clearedRowsCount = 0;
      const clearedBoard = newBoard.filter((row) => {
        const isFull = row.every((cell) => cell !== null);
        if (isFull) clearedRowsCount++;
        return !isFull;
      });

      while (clearedBoard.length < ROWS) {
        clearedBoard.unshift(Array(COLS).fill(null));
      }

      if (clearedRowsCount > 0 && action.onLineClear) {
        action.onLineClear(clearedRowsCount);
      }

      let scoreGain = 0;
      if (clearedRowsCount === 1) scoreGain = 100;
      else if (clearedRowsCount === 2) scoreGain = 300;
      else if (clearedRowsCount === 3) scoreGain = 500;
      else if (clearedRowsCount === 4) scoreGain = 800;

      // Add hard drop points: 2 points per cell dropped
      const finalScoreGain = (scoreGain + dropDistance * 2) * (Math.floor(state.lines / 10) + 1);
      const newLines = state.lines + clearedRowsCount;
      const newLevel = Math.floor(newLines / 10) + 1;
      const newScore = Math.min(999, state.score + finalScoreGain); // Cap at 999 as per MAX_SCORE_CAP.stack

      const newSpeed = Math.max(100, 800 - (newLevel - 1) * 70);

      // Spawn next piece
      let currentBag = [...state.bag];
      if (currentBag.length < 2) {
        currentBag = [...currentBag, ...generateBag()];
      }

      const nextType = currentBag.pop()!;
      const spawnedPiece: Tetromino = {
        type: state.nextPiece.type,
        matrix: state.nextPiece.matrix,
        color: state.nextPiece.color,
        x: getInitialSpawnX(state.nextPiece.type),
        y: state.nextPiece.type === 'I' ? -1 : 0,
      };

      const newNextPiece: Omit<Tetromino, 'x' | 'y'> = {
        type: nextType,
        matrix: TETROMINOES[nextType].matrix,
        color: TETROMINOES[nextType].color,
      };

      if (checkCollision(spawnedPiece, clearedBoard)) {
        if (action.onGameOver) action.onGameOver();
        return {
          ...state,
          board: clearedBoard,
          gameOver: true,
          score: newScore,
        };
      }

      return {
        ...state,
        board: clearedBoard,
        currentPiece: spawnedPiece,
        nextPiece: newNextPiece,
        hasHeld: false,
        bag: currentBag,
        score: newScore,
        lines: newLines,
        level: newLevel,
        speed: newSpeed,
      };
    }

    case 'HOLD': {
      if (state.hasHeld) return state;

      const currentType = state.currentPiece.type;
      let nextPieceToSpawn: Tetromino;
      let newNextPiece: Omit<Tetromino, 'x' | 'y'> = state.nextPiece;
      let currentBag = [...state.bag];

      if (state.holdPiece === null) {
        // First hold of the game
        const firstType = state.nextPiece.type;
        if (currentBag.length < 2) {
          currentBag = [...currentBag, ...generateBag()];
        }
        const nextType = currentBag.pop()!;

        nextPieceToSpawn = {
          type: firstType,
          matrix: TETROMINOES[firstType].matrix,
          color: TETROMINOES[firstType].color,
          x: getInitialSpawnX(firstType),
          y: firstType === 'I' ? -1 : 0,
        };

        newNextPiece = {
          type: nextType,
          matrix: TETROMINOES[nextType].matrix,
          color: TETROMINOES[nextType].color,
        };
      } else {
        // Swap with previously held piece
        const holdType = state.holdPiece.type;
        nextPieceToSpawn = {
          type: holdType,
          matrix: TETROMINOES[holdType].matrix,
          color: TETROMINOES[holdType].color,
          x: getInitialSpawnX(holdType),
          y: holdType === 'I' ? -1 : 0,
        };
      }

      const newHoldPiece: Omit<Tetromino, 'x' | 'y'> = {
        type: currentType,
        matrix: TETROMINOES[currentType].matrix,
        color: TETROMINOES[currentType].color,
      };

      // Check if the swapped piece instantly collides (Game Over)
      if (checkCollision(nextPieceToSpawn, state.board)) {
        return {
          ...state,
          gameOver: true,
        };
      }

      return {
        ...state,
        currentPiece: nextPieceToSpawn,
        nextPiece: newNextPiece,
        holdPiece: newHoldPiece,
        hasHeld: true,
        bag: currentBag,
      };
    }

    default:
      return state;
  }
}
