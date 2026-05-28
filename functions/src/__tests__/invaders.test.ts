import { invadersReducer, INITIAL_STATE } from '../../../src/games/invaders/invadersReducer';

describe('Space Invaders Reducer Logic', () => {
  test('should initialize with correct default state parameters', () => {
    const state = INITIAL_STATE(1);

    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.level).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.gameWon).toBe(false);
    expect(state.aliens.length).toBe(28); // 4 rows * 7 cols
    expect(state.bunkers.length).toBe(3); // 3 bunkers
    expect(state.shots.length).toBe(0);
    expect(state.ufo).toBeNull();
  });

  test('should move player horizontal coordinates within bounds', () => {
    let state = INITIAL_STATE(1);
    const startX = state.playerX;

    // Move left
    state = invadersReducer(state, { type: 'MOVE_PLAYER', dx: -20 });
    expect(state.playerX).toBe(startX - 20);

    // Touch layout mapping
    state = invadersReducer(state, { type: 'PLAYER_TOUCH', x: 100 });
    expect(state.playerX).toBe(100 - state.playerWidth / 2);
  });

  test('should trigger shot launch and observe shoot cooldown limits', () => {
    let state = INITIAL_STATE(1);

    // Initial shoot
    state = invadersReducer(state, { type: 'SHOOT' });
    expect(state.shots.length).toBe(1);
    expect(state.shootCooldown).toBe(400);

    // Duplicate shoot before cooldown ends
    state = invadersReducer(state, { type: 'SHOOT' });
    expect(state.shots.length).toBe(1); // Shot rejected
  });

  test('should process ticks to move shots and detect collisions', () => {
    let state = INITIAL_STATE(1);

    // Spawn a shot moving up right below alien at index 0
    const targetAlien = state.aliens[0];
    state.shots = [
      {
        id: 'test-shot-1',
        x: targetAlien.x + targetAlien.width / 2,
        y: targetAlien.y + targetAlien.height + 3,
        vy: -100, // moving up
      },
    ];

    // Trigger tick
    state = invadersReducer(state, { type: 'TICK', dt: 0.05 });

    // Shot travels 100px/s * 0.05s = 5px.
    // Alien position Y = targetAlien.y + targetAlien.height. The shot is at targetAlien.y + targetAlien.height + 3.
    // Moving 5px up puts the shot at targetAlien.y + targetAlien.height - 2, overlapping the alien.
    // It should hit and destroy the alien.
    expect(state.aliens.length).toBe(27);
    expect(state.shots.length).toBe(0); // shot consumed
    expect(state.score).toBe(30); // top row alien = 30 pts
  });

  test('should lose lives when hit by alien lasers', () => {
    let state = INITIAL_STATE(1);

    // Spawn shot moving down colliding with player
    state.shots = [
      {
        id: 'alien-shot-1',
        x: state.playerX + state.playerWidth / 2,
        y: 265, // Player height
        vy: 100, // moving down
      },
    ];

    state = invadersReducer(state, { type: 'TICK', dt: 0.05 });

    expect(state.lives).toBe(2);
    expect(state.shots.length).toBe(0); // consumed
  });
});
