/**
 * Union type representing the supported retro game identifiers.
 */
export type GameType = 'snake' | 'breaker' | 'invaders' | 'stack' | 'runner' | 'striker';


/**
 * Represents a single entry in the monthly leaderboard.
 */
export interface LeaderboardEntry {
  email: string;
  name: string;
  photoUrl: string | null;
  highScore: number;
  attempts: number;
  lastUpdated: number;
  gameType: GameType;
  monthKey: string;
}

/**
 * Represents the final recorded winner of a monthly challenge.
 */
export interface MonthWinner {
  email: string;
  name: string;
  photoUrl: string | null;
  finalScore: number;
  gameType: GameType;
  monthKey: string;
  prizeAmount: number;
  archivedAt: number;
}

/**
 * Game configuration document stored in Firestore.
 */
export interface GameConfig {
  activeGame: GameType;
  monthKey: string; // Format: "YYYY-MM"
  rotationIndex: number; // 0-4
  lastRotated: number; // Epoch timestamp
  prizeAmount: number;
  maxAttempts?: number; // Custom daily attempt limit
}

/**
 * Payload sent by the client when submitting a score.
 */
export interface ScoreSubmission {
  score: number;
  gameType: GameType;
  seed: string;
  actionLog: string; // Compressed JSON or action string for anti-cheat verification
  duration: number; // Duration of gameplay in seconds
  clientTimestamp: number;
}
