import { getJakartaMonthKey, getJakartaStartOfTodayMs } from '../index';

// Simple unit tests for backend helper logic
describe('Game Utilities & Helpers', () => {
  
  test('getJakartaMonthKey should format date to YYYY-MM in WIB', () => {
    // 2026-05-24 12:00:00 UTC = 2026-05-24 19:00:00 WIB
    const date = new Date(Date.UTC(2026, 4, 24, 12, 0, 0)); 
    const monthKey = getJakartaMonthKey(date);
    expect(monthKey).toBe('2026-05');
  });

  test('getJakartaMonthKey should handle year transitions correctly', () => {
    // 2026-12-31 23:00:00 UTC = 2027-01-01 06:00:00 WIB
    const date = new Date(Date.UTC(2026, 11, 31, 23, 0, 0));
    const monthKey = getJakartaMonthKey(date);
    expect(monthKey).toBe('2027-01');
  });

  test('getJakartaStartOfTodayMs should calculate midnight of today in WIB', () => {
    // 2026-05-24 15:30:00 UTC = 2026-05-24 22:30:00 WIB
    const date = new Date(Date.UTC(2026, 4, 24, 15, 30, 0));
    const startMs = getJakartaStartOfTodayMs(date);
    
    // Expected: 2026-05-24 00:00:00 GMT+7 (WIB)
    // = 2026-05-23 17:00:00 UTC
    const expected = new Date(Date.UTC(2026, 4, 23, 17, 0, 0)).getTime();
    expect(startMs).toBe(expected);
  });

});

// Mocking Firestore and testing scoring validation constraints
describe('Backend Scoring Validation Logic', () => {
  const MAX_SCORE_CAP: Record<string, number> = {
    snake: 9999,
    breaker: 99999,
  };

  const MIN_DURATION: Record<string, number> = {
    snake: 5,
    breaker: 8,
  };

  function simulateValidation(score: number, gameType: string, duration: number, actionLog: string, attemptsToday: number) {
    const cap = MAX_SCORE_CAP[gameType];
    if (cap === undefined) {
      return { success: false, message: 'Game type not supported' };
    }
    if (score < 0 || score > cap) {
      return { success: false, message: `Skor tidak wajar (0 - ${cap}).` };
    }
    const minDur = MIN_DURATION[gameType];
    if (duration < minDur) {
      return { success: false, message: 'Durasi terlalu singkat untuk mencapai skor ini.' };
    }
    if (score > 0 && (!actionLog || actionLog.trim().length < Math.max(1, duration * 0.2))) {
      return { success: false, message: 'Log aktivitas gerakan tidak wajar.' };
    }
    if (attemptsToday >= 10) {
      return { success: false, message: 'Batas percobaan harian Anda telah habis.' };
    }
    return { success: true };
  }

  test('should reject score above maximum cap', () => {
    const result = simulateValidation(10500, 'snake', 10, 'actions...', 2);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Skor tidak wajar');
  });

  test('should reject duration below minimum limit', () => {
    const result = simulateValidation(50, 'snake', 3, 'actions...', 2);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Durasi terlalu singkat');
  });

  test('should reject attempt if daily limit is exceeded', () => {
    const result = simulateValidation(120, 'snake', 12, 'actions...', 10);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Batas percobaan harian');
  });

  test('should reject empty actions log if score is positive', () => {
    const result = simulateValidation(120, 'snake', 12, '', 2);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Log aktivitas gerakan');
  });

  test('should approve valid score submission', () => {
    const result = simulateValidation(120, 'snake', 12, 'press_left,press_right,press_up', 2);
    expect(result.success).toBe(true);
  });

});
