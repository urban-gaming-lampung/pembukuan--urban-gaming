import { useRef, useCallback } from 'react';
import { GameType, ScoreSubmission } from '../types';

/**
 * useScoreSeed hook generates a unique cryptographically-random-like seed on initialization,
 * and maintains an array of player actions recorded with high-resolution relative timestamps.
 * Provides a helper to build the secure ScoreSubmission payload.
 */
export function useScoreSeed() {
  const seedRef = useRef<string>('');
  const actionLogRef = useRef<{ action: string; time: number }[]>([]);
  const startTimeRef = useRef<number>(0);

  const initSession = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    seedRef.current = `${timestamp}_${random}`;
    actionLogRef.current = [];
    startTimeRef.current = timestamp;
  }, []);

  const logAction = useCallback((action: string) => {
    if (startTimeRef.current === 0) return;
    const relativeTime = Date.now() - startTimeRef.current;
    
    // Safety check to prevent logs bloating memory
    if (actionLogRef.current.length < 5000) {
      actionLogRef.current.push({ action, time: relativeTime });
    }
  }, []);

  const buildPayload = useCallback((score: number, gameType: GameType): ScoreSubmission => {
    const endTime = Date.now();
    const duration = Math.max(1, Math.round((endTime - startTimeRef.current) / 1000));
    
    // Format action log as comma-separated entries, e.g. "UP:1200,LEFT:2500"
    const actionLogString = actionLogRef.current
      .map((log) => `${log.action}:${log.time}`)
      .join(',');

    return {
      score,
      gameType,
      seed: seedRef.current,
      actionLog: actionLogString,
      duration,
      clientTimestamp: endTime,
    };
  }, []);

  return {
    initSession,
    logAction,
    buildPayload,
    startTimeRef,
  };
}
