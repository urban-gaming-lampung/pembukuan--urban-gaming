import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import RankBadge from './RankBadge';
import { LeaderboardAvatar } from './CurrentLeaderboard';

interface UserRankCardProps {
  monthKey: string;
}

/**
 * UserRankCard showing the logged-in employee's personal rank and high score.
 * Rendered only if they are not in the top 10 leaderboard.
 */
export default function UserRankCard({ monthKey }: UserRankCardProps) {
  const [personalRank, setPersonalRank] = useState<number>(-1);
  const [personalScore, setPersonalScore] = useState<number>(0);
  const [hasPlayed, setHasPlayed] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{ name: string; photoUrl: string | null; profileColor?: string | null } | null>(null);

  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim() || '';

  useEffect(() => {
    if (!currentUserEmail || !monthKey) return;

    const leaderboardRef = collection(db, 'game_leaderboard');
    const q = query(leaderboardRef, where('monthKey', '==', monthKey));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allScores: { email: string; highScore: number }[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          allScores.push({
            email: data.email.toLowerCase().trim(),
            highScore: Number(data.highScore) || 0,
          });
        });

        // Sort scores descending to determine absolute rank
        allScores.sort((a, b) => b.highScore - a.highScore);

        const myIdx = allScores.findIndex((s) => s.email === currentUserEmail);
        if (myIdx >= 0) {
          setPersonalRank(myIdx + 1);
          setPersonalScore(allScores[myIdx].highScore);
          setHasPlayed(true);
        } else {
          setPersonalRank(-1);
          setPersonalScore(0);
          setHasPlayed(false);
        }
      },
      (err) => {
        console.error('Error calculating personal rank:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUserEmail, monthKey]);

  useEffect(() => {
    if (!currentUserEmail) return;
    const userRef = doc(db, 'users', currentUserEmail);
    return onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({
          name: currentUserEmail.split('@')[0].toUpperCase(),
          photoUrl: data.photoUrl || null,
          profileColor: data.profileColor || null,
        });
      } else {
        setUserProfile({
          name: currentUserEmail.split('@')[0].toUpperCase(),
          photoUrl: null,
          profileColor: null,
        });
      }
    });
  }, [currentUserEmail]);

  // If the user is in the top 10, we don't need to show this sticky card
  if (personalRank >= 1 && personalRank <= 10) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2C2C2E]/30 p-4 flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-3 text-left">
        {hasPlayed ? (
          <div className="shrink-0">
            <RankBadge rank={personalRank} size="sm" />
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            <Gamepad2 className="h-4 w-4" />
          </div>
        )}

        {userProfile && (
          <LeaderboardAvatar
            photoUrl={userProfile.photoUrl}
            name={userProfile.name}
            profileColor={userProfile.profileColor}
            size={36}
          />
        )}

        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Posisi Anda
          </span>
          <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
            {hasPlayed ? `Peringkat #${personalRank}` : 'Belum Berpartisipasi'}
          </span>
        </div>
      </div>

      <div className="text-right">
        {hasPlayed ? (
          <span className="font-pixel text-[10px] font-black text-emerald-500">
            {personalScore.toLocaleString('id-ID')} pts
          </span>
        ) : (
          <span className="text-xs font-semibold text-[#0A84FF] dark:text-[#0A84FF]">
            Main Sekarang!
          </span>
        )}
      </div>
    </div>
  );
}

