import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Set default region to Jakarta for all functions
setGlobalOptions({ region: 'asia-southeast1' });

// Game rotation configuration
const GAME_ROTATION = ['snake', 'breaker', 'invaders', 'stack', 'runner', 'striker'];

// Maximum score limits per game to identify abnormal submissions
const MAX_SCORE_CAP: Record<string, number> = {
  snake: 9999,
  breaker: 99999,
  invaders: 99999,
  stack: 999,
  runner: 99999,
  striker: 99999,
};

// Minimum duration in seconds required to prevent bot submissions
const MIN_DURATION: Record<string, number> = {
  snake: 5,
  breaker: 8,
  invaders: 8,
  stack: 3,
  runner: 5,
  striker: 5,
};

const MAX_ATTEMPTS_PER_DAY = 10;

/**
 * Returns the month key "YYYY-MM" for the current date in Jakarta timezone (WIB).
 */
export function getJakartaMonthKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

/**
 * Returns the UNIX timestamp representing the start of today (00:00:00) in Jakarta timezone (WIB).
 */
export function getJakartaStartOfTodayMs(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const startOfDayStr = `${year}-${month}-${day}T00:00:00+07:00`;
  return new Date(startOfDayStr).getTime();
}

/**
 * Cloud Function to retrieve the current server time.
 * Used on the client to check time sync and prevent offline tampering.
 */
export const getServerTime = onCall((request) => {
  return { serverTimestamp: Date.now() };
});

/**
 * Cloud Function to securely validate and submit a game score.
 * Verifies play constraints, stores attempts log, and updates leaderboard dynamically.
 */
export const validateAndSubmitScore = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Pengguna tidak terautentikasi.');
  }

  const email = auth.token.email?.toLowerCase().trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email tidak ditemukan.');
  }

  const { score, gameType, seed, actionLog, duration, clientTimestamp, monthKey } = request.data || {};

  // Basic validation parameters
  if (typeof score !== 'number' || !gameType || !monthKey) {
    throw new HttpsError('invalid-argument', 'Parameter input tidak lengkap atau tidak valid.');
  }

  // 1. Validate score limits
  const cap = MAX_SCORE_CAP[gameType];
  if (cap === undefined) {
    throw new HttpsError('invalid-argument', `Tipe game "${gameType}" tidak didukung.`);
  }

  if (score < 0 || score > cap) {
    return { success: false, newHighScore: false, message: `Skor tidak wajar (0 - ${cap}).` };
  }

  // 2. Validate play duration
  const minDur = MIN_DURATION[gameType];
  if (duration < minDur) {
    return { success: false, newHighScore: false, message: `Durasi terlalu singkat untuk mencapai skor ini.` };
  }

  // 3. Validate action logs presence
  if (score > 0 && (!actionLog || String(actionLog).trim().length < Math.max(1, duration * 0.2))) {
    return { success: false, newHighScore: false, message: `Log aktivitas gerakan tidak wajar.` };
  }

  // 4. Validate time sync
  const serverNow = Date.now();
  const timeDifference = Math.abs(serverNow - clientTimestamp);
  if (timeDifference > 600000) { // 10 minutes tolerance
    return { success: false, newHighScore: false, message: `Waktu perangkat tidak sinkron dengan server.` };
  }

  try {
    // Fetch dynamic maxAttempts from configuration
    const configSnap = await db.collection('data').doc('game_config').get();
    let maxAttempts = MAX_ATTEMPTS_PER_DAY; // Default to 10
    if (configSnap.exists) {
      const configData = configSnap.data();
      if (typeof configData?.maxAttempts === 'number' && configData.maxAttempts > 0) {
        maxAttempts = configData.maxAttempts;
      }
    }

    const attemptsCollection = db.collection('game_attempts');
    const startOfTodayMs = getJakartaStartOfTodayMs();

    // Query attempts today in Jakarta timezone
    const attemptsSnap = await attemptsCollection
      .where('email', '==', email)
      .where('monthKey', '==', monthKey)
      .where('clientTimestamp', '>=', startOfTodayMs)
      .get();

    if (attemptsSnap.size >= maxAttempts) {
      return { success: false, newHighScore: false, message: 'Batas percobaan harian Anda telah habis.' };
    }

    // Save attempts log
    const attemptDocRef = attemptsCollection.doc();
    await attemptDocRef.set({
      email,
      gameType,
      score,
      seed,
      actionLog,
      clientTimestamp,
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      monthKey,
      valid: true,
    });

    // Update Leaderboard via Transaction to ensure atomicity
    const leaderboardDocRef = db.collection('game_leaderboard').doc(`${monthKey}_${email}`);
    let isNewHighScore = false;

    await db.runTransaction(async (transaction) => {
      const leaderSnap = await transaction.get(leaderboardDocRef);
      let currentHighScore = 0;
      let attemptsCount = 0;

      if (leaderSnap.exists) {
        const data = leaderSnap.data();
        currentHighScore = Number(data?.highScore) || 0;
        attemptsCount = Number(data?.attempts) || 0;
      }

      const isHigher = score > currentHighScore;
      isNewHighScore = isHigher || !leaderSnap.exists;

      const updatedPayload: any = {
        email,
        monthKey,
        attempts: attemptsCount + 1,
        lastUpdated: Date.now(),
        gameType,
      };

      if (isNewHighScore) {
        updatedPayload.highScore = score;
      } else {
        // Keep existing high score
        updatedPayload.highScore = currentHighScore;
      }

      transaction.set(leaderboardDocRef, updatedPayload, { merge: true });
    });

    return {
      success: true,
      newHighScore: isNewHighScore,
      message: isNewHighScore ? 'Selamat! Anda mencetak rekor baru!' : 'Skor berhasil dikirim.',
    };
  } catch (err: any) {
    console.error('Error during score submission:', err);
    throw new HttpsError('internal', err.message || 'Terjadi kesalahan sistem internal.');
  }
});

/**
 * Cloud Function triggered on a schedule (1st of every month at 00:00 WIB).
 * Determines the winner of the previous month's challenge, records it in `/game_winners`,
 * and rotates `/data/game_config` to the next game in the sequence.
 */
export const rotateMonthlyGame = onSchedule(
  {
    schedule: '0 0 1 * *',
    timeZone: 'Asia/Jakarta',
  },
  async (event) => {
    console.log('Starting monthly challenge rotation...');

    const configDocRef = db.collection('data').doc('game_config');
    
    try {
      const configSnap = await configDocRef.get();
      let rotationIndex = 0;
      let currentMonthKey = getJakartaMonthKey();

      if (configSnap.exists) {
        const data = configSnap.data();
        rotationIndex = data?.rotationIndex || 0;
        currentMonthKey = data?.monthKey || getJakartaMonthKey();
      }

      // 1. Find the top scorer of the month that just ended
      const leaderboardColl = db.collection('game_leaderboard');
      const topScorerSnap = await leaderboardColl
        .where('monthKey', '==', currentMonthKey)
        .orderBy('highScore', 'desc')
        .limit(1)
        .get();

      if (!topScorerSnap.empty) {
        const winnerDoc = topScorerSnap.docs[0];
        const winnerData = winnerDoc.data();
        const winnerEmail = winnerData.email;
        const highScore = winnerData.highScore;
        const gameType = winnerData.gameType;

        // Fetch user profiles to enrich winner record
        const userDocRef = db.collection('users').doc(winnerEmail);
        const userSnap = await userDocRef.get();
        let winnerName = winnerEmail.split('@')[0].toUpperCase();
        let photoUrl = null;

        if (userSnap.exists) {
          const userData = userSnap.data();
          photoUrl = userData?.photoUrl || null;
        }

        // Save winner record
        const winnerDocRef = db.collection('game_winners').doc(currentMonthKey);
        await winnerDocRef.set({
          email: winnerEmail,
          name: winnerName,
          photoUrl,
          finalScore: highScore,
          gameType,
          monthKey: currentMonthKey,
          prizeAmount: 50000,
          archivedAt: Date.now(),
        });

        console.log(`Pemenang tantangan ${currentMonthKey} dicatat: ${winnerEmail} dengan skor ${highScore}`);
      } else {
        console.log(`Tidak ada kontestan tercatat untuk tantangan bulan ${currentMonthKey}.`);
      }

      // 2. Rotate to the next game
      const nextRotationIndex = (rotationIndex + 1) % GAME_ROTATION.length;
      const nextGame = GAME_ROTATION[nextRotationIndex];
      
      // Calculate new month key (current time is already 1st of new month)
      const nextMonthKey = getJakartaMonthKey();

      await configDocRef.set({
        activeGame: nextGame,
        monthKey: nextMonthKey,
        rotationIndex: nextRotationIndex,
        lastRotated: admin.firestore.FieldValue.serverTimestamp(),
        prizeAmount: 50000,
      }, { merge: true });

      console.log(`Challenge rotated successfully: Next game is "${nextGame}" for month "${nextMonthKey}"`);
    } catch (err) {
      console.error('Error during monthly rotation process:', err);
    }
  }
);
