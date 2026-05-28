import { stackReducer, INITIAL_STATE } from '../../../src/games/stack/stackReducer';

describe('Stack Master Reducer Logic', () => {
  test('should initialize with correct default state parameters', () => {
    const state = INITIAL_STATE();

    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.level).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.speed).toBe(800);
    expect(state.board.length).toBe(20);
    expect(state.board[0].length).toBe(10);
    expect(state.board.every((row) => row.every((cell) => cell === null))).toBe(true);
    expect(state.currentPiece).toBeDefined();
    expect(state.nextPiece).toBeDefined();
    expect(state.holdPiece).toBeNull();
    expect(state.hasHeld).toBe(false);
  });

  test('should move current piece left/right and block movement on boundary collision', () => {
    let state = INITIAL_STATE();
    
    // Set fixed piece (O piece) at X=0, Y=0
    state.currentPiece = {
      type: 'O',
      matrix: [[1, 1], [1, 1]],
      color: 'yellow',
      x: 0,
      y: 0,
    };

    // Try moving left - should be blocked by boundary (x = 0)
    let nextState = stackReducer(state, { type: 'MOVE_LEFT' });
    expect(nextState.currentPiece.x).toBe(0);

    // Move right - should succeed
    nextState = stackReducer(state, { type: 'MOVE_RIGHT' });
    expect(nextState.currentPiece.x).toBe(1);

    // Set fixed piece at X=8, Y=0 (width of O piece is 2, board width is 10, so X max is 8)
    state.currentPiece.x = 8;
    nextState = stackReducer(state, { type: 'MOVE_RIGHT' });
    expect(nextState.currentPiece.x).toBe(8); // Blocked at x=8 (8 + 2 = 10 cols)
  });

  test('should rotate current piece clockwise and use simple wall kick if blocked', () => {
    let state = INITIAL_STATE();

    // Standard rotation of T piece:
    // matrix:
    // [0, 1, 0]
    // [1, 1, 1]
    // [0, 0, 0]
    // rotated:
    // [0, 1, 0]
    // [0, 1, 1]
    // [0, 1, 0]
    state.currentPiece = {
      type: 'T',
      matrix: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      color: 'purple',
      x: 3,
      y: 5,
    };

    const nextState = stackReducer(state, { type: 'ROTATE' });
    expect(nextState.currentPiece.matrix).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ]);
  });

  test('should drop current piece down on TICK / MOVE_DOWN', () => {
    let state = INITIAL_STATE();
    state.currentPiece.y = 5;

    const nextState = stackReducer(state, { type: 'MOVE_DOWN' });
    expect(nextState.currentPiece.y).toBe(6);
  });

  test('should hold current piece and swap it', () => {
    let state = INITIAL_STATE();
    const initialCurrentType = state.currentPiece.type;
    const initialNextType = state.nextPiece.type;

    // First hold - holdPiece becomes initialCurrentType, currentPiece becomes initialNextType
    let nextState = stackReducer(state, { type: 'HOLD' });
    expect(nextState.holdPiece?.type).toBe(initialCurrentType);
    expect(nextState.currentPiece.type).toBe(initialNextType);
    expect(nextState.hasHeld).toBe(true);

    // Try to hold again immediately - should be blocked (hasHeld is true)
    const afterSecondHold = stackReducer(nextState, { type: 'HOLD' });
    expect(afterSecondHold.holdPiece?.type).toBe(initialCurrentType);
    expect(afterSecondHold.currentPiece.type).toBe(initialNextType);
  });

  test('should lock piece at bottom, clear full rows, and add scores', () => {
    let state = INITIAL_STATE();
    
    // Fill row 19 completely except for first two columns
    for (let c = 2; c < 10; c++) {
      state.board[19][c] = 'red';
    }

    // Place an O piece (2x2) at X=0, Y=18
    state.currentPiece = {
      type: 'O',
      matrix: [
        [1, 1],
        [1, 1],
      ],
      color: 'yellow',
      x: 0,
      y: 18,
    };

    // MOVE_DOWN triggers lock because moving to Y=19 causes collision on bottom row (19 + 2 = 21 > 20 rows)
    const nextState = stackReducer(state, { type: 'MOVE_DOWN' });

    // The O piece fills board[18][0], board[18][1], board[19][0], board[19][1]
    // Since board[19] is now fully filled (col 0-1 filled with O piece, col 2-9 previously filled with red), it should clear!
    // Row 19 clears. Row 18 moves down to 19.
    expect(nextState.lines).toBe(1);
    expect(nextState.score).toBe(100); // 100 * level(1)
  });
});
