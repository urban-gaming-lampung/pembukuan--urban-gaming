import { breakerReducer, INITIAL_STATE, generateBricks } from '../../../src/games/breaker/breakerReducer';

describe('Brick Breaker Reducer Logic', () => {
  test('should initialize with correct default state parameters', () => {
    const state = INITIAL_STATE(1);
    
    expect(state.level).toBe(1);
    expect(state.score).toBe(0);
    expect(state.lives).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.gameWon).toBe(false);
    expect(state.ballLaunched).toBe(false);
    expect(state.balls.length).toBe(1);
    expect(state.bricks.length).toBe(48); // 8 cols * 6 rows
  });

  test('should generate brick lists with random powerups', () => {
    const bricks = generateBricks(1);
    expect(bricks.length).toBe(48);
    // Grid alignment checks
    expect(bricks[0].x).toBe(0);
    expect(bricks[0].y).toBe(0);
    expect(bricks[47].x).toBe(7);
    expect(bricks[47].y).toBe(5);
  });

  test('should launch ball with trajectory and set launched flag', () => {
    let state = INITIAL_STATE(1);
    expect(state.ballLaunched).toBe(false);
    expect(state.balls[0].vx).toBe(0);
    expect(state.balls[0].vy).toBe(0);

    state = breakerReducer(state, { type: 'LAUNCH_BALL' });

    expect(state.ballLaunched).toBe(true);
    expect(state.balls[0].vx).not.toBe(0);
    expect(state.balls[0].vy).not.toBe(0);
  });

  test('should move paddle and lock ball prior to launching', () => {
    let state = INITIAL_STATE(1);
    const initialPaddleX = state.paddleX;
    const initialBallX = state.balls[0].x;

    // Move left
    state = breakerReducer(state, { type: 'MOVE_PADDLE', dx: -10 });
    expect(state.paddleX).toBe(initialPaddleX - 10);
    expect(state.balls[0].x).toBe(initialBallX - 10); // Ball moves with paddle

    // Launch ball
    state = breakerReducer(state, { type: 'LAUNCH_BALL' });
    const ballXAfterLaunch = state.balls[0].x;

    // Move paddle again after launch
    state = breakerReducer(state, { type: 'MOVE_PADDLE', dx: 15 });
    expect(state.paddleX).toBe(initialPaddleX - 10 + 15);
    expect(state.balls[0].x).toBe(ballXAfterLaunch); // Ball does NOT move with paddle anymore
  });

  test('should move paddle to touch position', () => {
    let state = INITIAL_STATE(1);
    
    // Touch paddle center to 200px
    state = breakerReducer(state, { type: 'PADDLE_TOUCH', x: 200 });
    expect(state.paddleX).toBe(200 - state.paddleWidth / 2);
  });

  test('should tick timers and decrease active powerup durations', () => {
    let state = INITIAL_STATE(1);
    state.activePowerUps.wide = 2000; // 2 seconds wide paddle
    state.activePowerUps.slow = 1000; // 1 second slow ball

    state = breakerReducer(state, { type: 'TICK', dt: 0.1 }); // 0.1s tick = 100ms

    expect(state.activePowerUps.wide).toBe(1900);
    expect(state.activePowerUps.slow).toBe(900);
  });
});
