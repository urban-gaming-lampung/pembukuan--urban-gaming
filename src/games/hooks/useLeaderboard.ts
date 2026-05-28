import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { LeaderboardEntry } from '../types';

// In-memory cache for user profiles to avoid repeated Firestore reads
const profileCache = new Map<string, { name: string; photoUrl: string | null; profileColor?: string | null }>();

/**
 * Custom hook to listen to the real-time leaderboard of the specified month.
 * Automatically enriches entry data with user details (name and avatar photo) from `/users/{email}`.
 * 
 * @param monthKey The target month key (format: "YYYY-MM").
 * @returns Leaderboard entries, loading state, current user's rank, and current user's entry.
 */
export function useLeaderboard(monthKey: string) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [profilesState, setProfilesState] = useState<Record<string, { name: string; photoUrl: string | null; profileColor?: string | null }>>({});

  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim() || '';

  useEffect(() => {
    if (!monthKey) {
      setLoading(false);
      return;
    }

    const leaderboardRef = collection(db, 'game_leaderboard');
    const q = query(
      leaderboardRef,
      where('monthKey', '==', monthKey),
      orderBy('highScore', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawEntries: any[] = [];
        snapshot.forEach((docSnap) => {
          rawEntries.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Trigger fetches for any profiles not in cache
        const fetchPromises = rawEntries.map(async (entry) => {
          const email = entry.email.toLowerCase().trim();
          
          if (!profileCache.has(email)) {
            // Placeholder while loading
            profileCache.set(email, { name: email.split('@')[0].toUpperCase(), photoUrl: null, profileColor: null });

            try {
              const userRef = doc(db, 'users', email);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const data = userSnap.data();
                profileCache.set(email, {
                  name: email.split('@')[0].toUpperCase(), // Base Name
                  photoUrl: data.photoUrl || null,
                  profileColor: data.profileColor || null,
                });
              }
            } catch (err) {
              console.error(`Failed to fetch user profile for ${email}:`, err);
            }
          }
        });

        if (fetchPromises.length > 0) {
          await Promise.all(fetchPromises);
        }

        // Update state to force re-render with the latest profiles
        const newProfilesState: Record<string, { name: string; photoUrl: string | null; profileColor?: string | null }> = {};
        rawEntries.forEach((entry) => {
          const email = entry.email.toLowerCase().trim();
          newProfilesState[email] = profileCache.get(email) || {
            name: email.split('@')[0].toUpperCase(),
            photoUrl: null,
            profileColor: null,
          };
        });
        setProfilesState(newProfilesState);

        // Format and enrich the entries
        const enriched: any[] = rawEntries.map((entry) => {
          const email = entry.email.toLowerCase().trim();
          const profile = profileCache.get(email) || {
            name: email.split('@')[0].toUpperCase(),
            photoUrl: null,
            profileColor: null,
          };

          return {
            email: entry.email,
            name: profile.name,
            photoUrl: profile.photoUrl,
            profileColor: profile.profileColor || null,
            highScore: Number(entry.highScore) || 0,
            attempts: Number(entry.attempts) || 0,
            lastUpdated: Number(entry.lastUpdated) || Date.now(),
            gameType: entry.gameType,
            monthKey: entry.monthKey,
          };
        });

        setEntries(enriched);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to game leaderboard:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [monthKey]);


  // Compute current user's rank and entry
  const { currentUserRank, currentUserEntry } = useMemo(() => {
    if (!currentUserEmail || entries.length === 0) {
      return { currentUserRank: -1, currentUserEntry: null };
    }
    const index = entries.findIndex((e) => e.email.toLowerCase().trim() === currentUserEmail);
    if (index >= 0) {
      return {
        currentUserRank: index + 1,
        currentUserEntry: entries[index],
      };
    }
    return { currentUserRank: -1, currentUserEntry: null };
  }, [entries, currentUserEmail]);

  return { entries, loading, currentUserRank, currentUserEntry };
}
