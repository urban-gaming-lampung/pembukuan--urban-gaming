import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { GameConfig } from '../types';

/**
 * Custom hook to listen to the real-time configuration of the monthly active game.
 * Subscribes to the Firestore doc `/data/game_config`.
 * 
 * @returns An object containing the game configuration, loading state, and error.
 */
export function useGameConfig() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'data', 'game_config');

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as GameConfig);
        } else {
          setConfig(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to game config:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { config, loading, error };
}
