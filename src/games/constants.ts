import { GameType } from './types';

/**
 * Array of games in their monthly rotation order.
 */
export const GAME_ROTATION: GameType[] = ['snake', 'breaker', 'invaders', 'stack', 'runner', 'striker'];

/**
 * Default monthly cash prize in IDR for the top leader.
 */
export const MONTH_PRIZE = 50000;

/**
 * Maximum achievable score caps per game to prevent outlier cheating.
 */
export const MAX_SCORE_CAP: Record<GameType, number> = {
  snake: 9999,
  breaker: 99999,
  invaders: 99999,
  stack: 999,
  runner: 99999,
  striker: 99999,
};

/**
 * Maximum game session attempts allowed per employee per calendar date.
 */
export const MAX_ATTEMPTS_PER_DAY = 10;

/**
 * Mapping of game identifiers to Indonesian display names.
 */
export const GAME_NAMES_ID: Record<GameType, string> = {
  snake: 'Ular Klasik (Snake)',
  breaker: 'Penghancur Bata (Brick Breaker)',
  invaders: 'Penjajah Luar Angkasa (Space Invaders)',
  stack: 'Tumpuk Balok (Stack)',
  runner: 'Pelari Tak Terbatas (Endless Runner)',
  striker: 'Sky Striker',
};

