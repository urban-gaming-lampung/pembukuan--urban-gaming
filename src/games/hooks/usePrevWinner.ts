import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MonthWinner } from '../types';

/**
 * Custom hook to retrieve the recorded winner of the previous month.
 * Performs a one-time fetch to `/game_winners/{prevMonthKey}` when mounted.
 * 
 * @param prevMonthKey The month key of the previous month (format: "YYYY-MM").
 * @returns The winner details and loading status.
 */
export function usePrevWinner(prevMonthKey: string) {
  const [winner, setWinner] = useState<MonthWinner | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!prevMonthKey) {
      setLoading(false);
      return;
    }

    const fetchWinner = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'game_winners', prevMonthKey);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setWinner(docSnap.data() as MonthWinner);
        } else {
          setWinner(null);
        }
      } catch (err) {
        console.error(`Failed to retrieve winner for key ${prevMonthKey}:`, err);
        setWinner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWinner();
  }, [prevMonthKey]);

  return { winner, loading };
}
