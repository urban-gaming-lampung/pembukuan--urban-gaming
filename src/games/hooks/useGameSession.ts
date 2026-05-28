import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../../lib/firebase';
import { ScoreSubmission } from '../types';
import { MAX_ATTEMPTS_PER_DAY } from '../constants';
import { validateClientScore } from '../utils/scoreValidator';

/**
 * Custom hook to manage the gameplay session.
 * Tracks daily attempts, verifies play eligibility, and handles secure score submission via Cloud Functions.
 * 
 * @param monthKey The current month key (format: "YYYY-MM").
 * @param gameType The active game identifier.
 * @param currentHighScore The current high score of the user (used for optimistic updates).
 * @returns State and functions to manage the game session.
 */
export function useGameSession(monthKey: string, gameType: string, currentHighScore: number = 0, initialMaxAttempts: number = 10) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsToday, setAttemptsToday] = useState<number>(0);
  const [optimisticHighScore, setOptimisticHighScore] = useState<number>(currentHighScore);
  const [maxAttemptsLimit, setMaxAttemptsLimit] = useState<number>(initialMaxAttempts);

  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim() || '';

  // Synchronize optimistic high score when database value changes
  useEffect(() => {
    setOptimisticHighScore(currentHighScore);
  }, [currentHighScore]);

  // Listen to the custom maxAttempts configuration from Firestore
  useEffect(() => {
    const docRef = doc(db, 'data', 'game_config');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.maxAttempts === 'number' && data.maxAttempts > 0) {
            setMaxAttemptsLimit(data.maxAttempts);
            return;
          }
        }
        setMaxAttemptsLimit(initialMaxAttempts);
      },
      (err) => {
        console.error('Error fetching game config in useGameSession:', err);
      }
    );
    return () => unsubscribe();
  }, [initialMaxAttempts]);

  // Real-time listener for current day attempts to avoid composite index requirements
  useEffect(() => {
    if (!currentUserEmail || !monthKey) return;

    const attemptsRef = collection(db, 'game_attempts');
    const q = query(
      attemptsRef,
      where('email', '==', currentUserEmail),
      where('monthKey', '==', monthKey)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Calculate start of today in local time
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayMs = startOfToday.getTime();

        let count = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.clientTimestamp && data.clientTimestamp >= startOfTodayMs) {
            count++;
          }
        });
        setAttemptsToday(count);
      },
      (err) => {
        console.error('Error listening to attempts count:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUserEmail, monthKey]);

  const attemptsLeftToday = Math.max(0, maxAttemptsLimit - attemptsToday);
  const canPlay = attemptsLeftToday > 0;

  const submitScore = useCallback(
    async (submission: ScoreSubmission): Promise<{ success: boolean; isNewHighScore: boolean; message: string }> => {
      setLoading(true);
      setError(null);

      // 1. Client-side local validation
      const localVal = validateClientScore(
        submission.score,
        submission.gameType,
        submission.duration,
        submission.actionLog
      );

      if (!localVal.isValid) {
        const errMsg = localVal.message || 'Validasi skor lokal gagal.';
        setError(errMsg);
        setLoading(false);
        return { success: false, isNewHighScore: false, message: errMsg };
      }

      if (attemptsToday >= maxAttemptsLimit) {
        const errMsg = 'Batas percobaan harian Anda telah habis.';
        setError(errMsg);
        setLoading(false);
        return { success: false, isNewHighScore: false, message: errMsg };
      }

      // 2. Optimistic UI update (if score is greater than current high score)
      let isOptimisticNewHigh = false;
      if (submission.score > optimisticHighScore) {
        setOptimisticHighScore(submission.score);
        isOptimisticNewHigh = true;
      }

      try {
        // Initialize Functions on the fly using the authenticated App instance
        const functions = getFunctions(auth.app, 'asia-southeast1');
        const validateAndSubmit = httpsCallable<any, any>(functions, 'validateAndSubmitScore');

        const response = await validateAndSubmit({
          ...submission,
          monthKey,
        });

        const result = response.data;

        if (result.success) {
          if (!result.newHighScore) {
            // Revert optimistic update if the server said it wasn't a new high score
            setOptimisticHighScore(currentHighScore);
          }
          setLoading(false);
          return {
            success: true,
            isNewHighScore: result.newHighScore,
            message: result.message || 'Skor berhasil dikirim!',
          };
        } else {
          // Revert optimistic update on failure
          setOptimisticHighScore(currentHighScore);
          setError(result.message || 'Gagal memvalidasi skor di server.');
          setLoading(false);
          return {
            success: false,
            isNewHighScore: false,
            message: result.message || 'Gagal memvalidasi skor.',
          };
        }
      } catch (err: any) {
        // Revert optimistic update on error
        setOptimisticHighScore(currentHighScore);
        const errMsg = err.message || 'Terjadi kesalahan jaringan/server.';
        setError(errMsg);
        setLoading(false);
        return { success: false, isNewHighScore: false, message: errMsg };
      }
    },
    [attemptsToday, optimisticHighScore, currentHighScore, monthKey, maxAttemptsLimit]
  );

  return { submitScore, canPlay, attemptsLeftToday, loading, error, optimisticHighScore };
}
