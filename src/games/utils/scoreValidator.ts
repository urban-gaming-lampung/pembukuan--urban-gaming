import { GameType } from '../types';
import { MAX_SCORE_CAP } from '../constants';

/**
 * Minimum expected play duration in seconds per game to prevent instant bot submissions.
 */
export const MIN_DURATION_LIMITS: Record<GameType, number> = {
  snake: 5,
  breaker: 8,
  invaders: 8,
  stack: 3,
  runner: 5,
  striker: 5,
};

/**
 * Validates score submission details on the client before calling backend.
 * @param score The score achieved.
 * @param gameType The identifier of the game played.
 * @param duration The duration of the play session in seconds.
 * @param actionLog The log of player input actions.
 * @returns An object containing the validation status and an optional error message.
 */
export function validateClientScore(
  score: number,
  gameType: GameType,
  duration: number,
  actionLog: string
): { isValid: boolean; message?: string } {
  if (score < 0) {
    return { isValid: false, message: 'Skor tidak boleh negatif.' };
  }

  const cap = MAX_SCORE_CAP[gameType];
  if (score > cap) {
    return { isValid: false, message: `Skor melebihi batas maksimal wajar (${cap}) untuk game ini.` };
  }

  const minDuration = MIN_DURATION_LIMITS[gameType];
  if (duration < minDuration) {
    return { isValid: false, message: `Durasi bermain terlalu cepat (minimal ${minDuration} detik).` };
  }

  // Basic check: an active gameplay must record some keystroke/action inputs
  // We expect at least one action if score > 0
  if (score > 0 && (!actionLog || actionLog.trim().length === 0)) {
    return { isValid: false, message: 'Tidak ada log aktivitas gerakan terdeteksi.' };
  }

  return { isValid: true };
}
