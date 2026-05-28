import { strikerReducer, INITIAL_STATE } from '../../../src/games/striker/strikerReducer';

describe('Sky Striker Reducer Logic', () => {
  test('should initialize with correct default state parameters', () => {
    const state = INITIAL_STATE();

    expect(state.score).toBe(0);
    expect(state.lives).toBe(1);
    expect(state.playerHp).toBe(100);
    expect(state.playerMaxHp).toBe(100);
    expect(state.stage).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.gameWon).toBe(false);
    expect(state.rollsRemaining).toBe(3);
    expect(state.isRolling).toBe(false);
    expect(state.weaponLevel).toBe(2); // Starts as Twin Cannon
    expect(state.bullets.length).toBe(0);
    expect(state.enemies.length).toBe(0);
    expect(state.boss).toBeNull();
    expect(state.items.length).toBe(0);
  });

  test('should move player in 2D within bounds', () => {
    let state = INITIAL_STATE();
    const startX = state.playerX;
    const startY = state.playerY;

    state = strikerReducer(state, { type: 'MOVE_PLAYER', dx: -15, dy: -20 });
    expect(state.playerX).toBe(startX - 15);
    expect(state.playerY).toBe(startY - 20);

    state = strikerReducer(state, { type: 'PLAYER_TOUCH', x: 200, y: 150 });
    expect(state.playerX).toBe(200);
    expect(state.playerY).toBe(150);
  });

  test('should execute roll loop-the-loop and register invincibility', () => {
    let state = INITIAL_STATE();

    state = strikerReducer(state, { type: 'TRIGGER_ROLL' });
    expect(state.isRolling).toBe(true);
    expect(state.rollsRemaining).toBe(2);

    state.bullets = [
      {
        id: 'ebullet-1',
        x: state.playerX,
        y: state.playerY,
        vx: 0,
        vy: 100,
        isEnemy: true,
      },
    ];

    state = strikerReducer(state, { type: 'TICK', dt: 0.05 });
    expect(state.gameOver).toBe(false);
    expect(state.playerHp).toBe(100); // Invincible during roll
  });

  test('should decrease player HP on bullet hit, and trigger game over on zero HP', () => {
    let state = INITIAL_STATE();
    expect(state.isRolling).toBe(false);
    expect(state.playerHp).toBe(100);

    // 1. Single bullet hit decreases HP
    state.bullets = [
      {
        id: 'ebullet-1',
        x: state.playerX,
        y: state.playerY,
        vx: 0,
        vy: 100,
        isEnemy: true,
      },
    ];
    state = strikerReducer(state, { type: 'TICK', dt: 0.05 });
    expect(state.playerHp).toBe(92); // 100 - 8 (Stage 1 bullet damage)
    expect(state.gameOver).toBe(false);

    // 2. Reduce HP to 0
    state.playerHp = 5;
    state.bullets = [
      {
        id: 'ebullet-2',
        x: state.playerX,
        y: state.playerY,
        vx: 0,
        vy: 100,
        isEnemy: true,
      },
    ];
    state = strikerReducer(state, { type: 'TICK', dt: 0.05 });
    expect(state.playerHp).toBe(0);
    expect(state.lives).toBe(0);
    expect(state.gameOver).toBe(true);
  });

  test('should collect Pow item and upgrade weapon level to 3', () => {
    let state = INITIAL_STATE();
    expect(state.weaponLevel).toBe(2);

    state.items = [
      {
        id: 'pow-1',
        x: state.playerX,
        y: state.playerY,
        vy: 10,
        width: 10,
        height: 10,
        type: 'pow',
      },
    ];

    state = strikerReducer(state, { type: 'TICK', dt: 0.02 });
    expect(state.weaponLevel).toBe(3); // Upgraded to Triple Laser
    expect(state.score).toBe(500);
    expect(state.items.length).toBe(0);
  });

  test('should progress stage sequence on boss defeat and heal player', () => {
    let state = INITIAL_STATE();
    state.playerHp = 40; // damaged player

    // 1. Trigger boss warning
    state.stageProgress = 30000;
    state = strikerReducer(state, { type: 'TICK', dt: 0.1 });
    expect(state.bossWarningTimer).toBeGreaterThan(0);

    // 2. Spawn boss
    state.bossWarningTimer = 10;
    state = strikerReducer(state, { type: 'TICK', dt: 0.02 });
    expect(state.boss).not.toBeNull();
    expect(state.boss!.name).toBe('BOMBER KAI');

    // 3. Defeat boss
    state.boss!.hp = 0;
    state = strikerReducer(state, { type: 'TICK', dt: 0.02 });
    expect(state.stageClearTimer).toBeGreaterThan(0);
    expect(state.score).toBe(5000);

    // 4. Advance stage and heal
    state.stageClearTimer = 10;
    state = strikerReducer(state, { type: 'TICK', dt: 0.02 });
    expect(state.stage).toBe(2);
    expect(state.playerHp).toBe(100); // Fully healed
    expect(state.rollsRemaining).toBe(5); // Cap rolls to 5
  });
});
