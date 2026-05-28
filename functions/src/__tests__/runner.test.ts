import { runnerReducer, INITIAL_STATE, FLOOR_Y, PLAYER_HEIGHT } from '../../../src/games/runner/runnerReducer';

describe('Neon Runner Reducer Logic', () => {
  test('should initialize with correct default state parameters', () => {
    const state = INITIAL_STATE();

    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.isJumping).toBe(false);
    expect(state.isDoubleJumping).toBe(false);
    expect(state.isSliding).toBe(false);
    expect(state.obstacles.length).toBe(0);
    expect(state.coins.length).toBe(0);
    expect(state.playerY).toBe(FLOOR_Y - PLAYER_HEIGHT);
  });

  test('should perform jumps and double jumps but block triple jumps', () => {
    let state = INITIAL_STATE();

    // First jump
    state = runnerReducer(state, { type: 'JUMP' });
    expect(state.isJumping).toBe(true);
    expect(state.isDoubleJumping).toBe(false);
    expect(state.playerVY).toBeLessThan(0);

    // Double jump
    state = runnerReducer(state, { type: 'JUMP' });
    expect(state.isJumping).toBe(true);
    expect(state.isDoubleJumping).toBe(true);

    // Triple jump attempt - should be ignored (stays in double jump state)
    const prevVY = state.playerVY;
    state = runnerReducer(state, { type: 'JUMP' });
    expect(state.playerVY).toBe(prevVY);
  });

  test('should enter slide state and block jump actions during slide', () => {
    let state = INITIAL_STATE();

    // Trigger slide
    state = runnerReducer(state, { type: 'SLIDE' });
    expect(state.isSliding).toBe(true);
    expect(state.slideTimer).toBe(650);

    // Try jumping during slide - should be rejected
    state = runnerReducer(state, { type: 'JUMP' });
    expect(state.isJumping).toBe(false);
  });

  test('should drop fast on GROUND_POUND when jumping', () => {
    let state = INITIAL_STATE();
    state = runnerReducer(state, { type: 'JUMP' });
    
    state = runnerReducer(state, { type: 'GROUND_POUND' });
    expect(state.playerVY).toBe(350); // Downward force velocity
  });

  test('should detect collision and trigger game over on hitting obstacle', () => {
    let state = INITIAL_STATE();
    
    // Spawn obstacle that will overlap player after tick movement
    state.obstacles = [
      {
        id: 'o-1',
        x: 62,
        y: FLOOR_Y - 14,
        width: 14,
        height: 14,
        type: 'spike',
      },
    ];

    state = runnerReducer(state, { type: 'TICK', dt: 0.1 });
    expect(state.gameOver).toBe(true);
  });

  test('should collect coins and increase score on overlap', () => {
    let state = INITIAL_STATE();

    // Spawn coin that will overlap player after tick movement
    state.coins = [
      {
        id: 'c-1',
        x: 62,
        y: FLOOR_Y - 18,
        width: 8,
        height: 8,
      },
    ];

    state = runnerReducer(state, { type: 'TICK', dt: 0.1 });
    // Coin (15) + Survival Distance Points (1) = 16
    expect(state.score).toBe(16); 
    expect(state.coins.length).toBe(0); // consumed
  });
});
