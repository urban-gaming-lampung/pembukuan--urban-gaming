import React, { useEffect, useState } from 'react';
import { Crown, Gift } from 'lucide-react';
import { usePrevWinner } from '../hooks/usePrevWinner';
import { GAME_NAMES_ID } from '../constants';
import RankBadge from './RankBadge';
import { LeaderboardAvatar } from './CurrentLeaderboard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PrevWinnerCardProps {
  prevMonthKey: string;
}

function formatMonthName(monthKey: string): string {
  if (!monthKey) return '';
  const [yearStr, monthStr] = monthKey.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const idx = parseInt(monthStr, 10) - 1;
  return `${monthNames[idx] || monthStr} ${yearStr}`;
}

/**
 * PrevWinnerCard displaying the winner of the previous month's challenge.
 * Styled with Apple Gold theme and pixelated details.
 */
export default function PrevWinnerCard({ prevMonthKey }: PrevWinnerCardProps) {
  const { winner, loading } = usePrevWinner(prevMonthKey);
  const [profileColor, setProfileColor] = useState<string | null>(null);

  useEffect(() => {
    if (!winner?.email) return;
    const userRef = doc(db, 'users', winner.email.toLowerCase().trim());
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setProfileColor(snap.data().profileColor || null);
      }
    }).catch(console.error);
  }, [winner]);

  if (loading) {
    // Apple-style Skeleton Loading State
    return (
      <div className="flex w-full items-center gap-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 p-4 border border-amber-500/20 animate-pulse">
        <div className="h-14 w-14 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-zinc-300 dark:bg-zinc-700" />
          <div className="h-4 w-2/3 rounded bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </div>
    );
  }

  if (!winner) {
    // No winner recorded (e.g. first month of system activation or empty leaderboard)
    return null;
  }

  const gameDisplay = GAME_NAMES_ID[winner.gameType] || winner.gameType;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 dark:from-amber-500/20 dark:to-yellow-500/5 p-5 flex items-center gap-4">
      {/* Winner Avatar (56px) with Rank 1 Overlay */}
      <div className="relative shrink-0 w-[56px] h-[56px]">
        <LeaderboardAvatar
          photoUrl={winner.photoUrl}
          name={winner.name}
          profileColor={profileColor}
          size={56}
        />
        <div className="absolute -bottom-1 -right-1 z-10 shadow-md">
          <RankBadge rank={1} size="sm" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-16 text-left">
        <span className="font-pixel text-[8px] tracking-wider text-amber-600 dark:text-amber-400 uppercase font-black">
          JUARA BULAN LALU ({formatMonthName(prevMonthKey)})
        </span>
        <h4 className="text-base font-black text-zinc-900 dark:text-white truncate mt-1">
          {winner.name}
        </h4>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
          Skor: <span className="font-pixel text-[9px] text-amber-600 dark:text-amber-400 font-black">{winner.finalScore}</span> di {gameDisplay}
        </p>
      </div>

      {/* Cash Prize Badge */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20">
        <Gift className="h-3.5 w-3.5" />
        <span>Rp 50K</span>
      </div>
    </div>
  );
}

