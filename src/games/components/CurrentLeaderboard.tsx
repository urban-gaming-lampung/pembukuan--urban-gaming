import React from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { auth } from '../../lib/firebase';
import UserRankCard from './UserRankCard';
import RankBadge from './RankBadge';

interface CurrentLeaderboardProps {
  monthKey: string;
}

/**
 * Helper component to render employee avatars safely with fallback initial letter
 * and Firestore profileColor background. Prevents distortions.
 */
export function LeaderboardAvatar({
  photoUrl,
  name,
  profileColor,
  size = 36,
}: {
  photoUrl: string | null;
  name: string;
  profileColor?: string | null;
  size?: number;
}) {
  const [imgError, setImgError] = React.useState(false);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className="avatar-container relative shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm flex items-center justify-center font-bold text-white select-none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: profileColor || '#8E8E93',
      }}
    >
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={name}
          className="avatar-img"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-bold uppercase" style={{ fontSize: `${Math.floor(size * 0.4)}px` }}>
          {initial}
        </span>
      )}
    </div>
  );
}

/**
 * Renders the top 10 leaders of the current month.
 * Automatically highlights the current user.
 */
export default function CurrentLeaderboard({ monthKey }: CurrentLeaderboardProps) {
  const { entries, loading, currentUserRank } = useLeaderboard(monthKey);
  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim() || '';

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-left">
          Peringkat Pegawai
        </h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex h-14 w-full items-center gap-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 p-3 animate-pulse">
            <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="h-8 w-8 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-zinc-300 dark:bg-zinc-700" />
            </div>
            <div className="h-4 w-12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-left">
          Klasemen Sementara
        </h3>
        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
          {entries.length} Pegawai Aktif
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center bg-zinc-50/50 dark:bg-black/5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Belum ada yang bermain bulan ini.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Jadilah yang pertama untuk memimpin klasemen!
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-black/10 divide-y divide-zinc-100 dark:divide-zinc-800/50">
          {entries.map((entry, idx) => {
            const isMe = entry.email.toLowerCase().trim() === currentUserEmail;
            const rank = idx + 1;

            return (
              <div
                key={entry.email}
                className={`flex items-center justify-between p-4 transition-colors duration-200 ${
                  isMe
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-l-4 border-emerald-500'
                    : 'hover:bg-zinc-100/50 dark:hover:bg-zinc-800/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Indicator */}
                  <div className="shrink-0 flex items-center justify-center w-10">
                    <RankBadge rank={rank} size="md" />
                  </div>

                  {/* Profile Picture */}
                  <LeaderboardAvatar
                    photoUrl={entry.photoUrl}
                    name={entry.name}
                    profileColor={entry.profileColor}
                    size={36}
                  />

                  {/* Name */}
                  <div className="flex flex-col min-w-0 text-left">
                    <span className={`text-sm font-black truncate capitalize ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {entry.attempts} bermain
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <span className="font-pixel text-[11px] font-black text-zinc-900 dark:text-white">
                    {entry.highScore.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Sticky User Rank Card (Tampil jika user tidak di top 10) */}
      {currentUserEmail && currentUserRank === -1 && monthKey && (
        <UserRankCard monthKey={monthKey} />
      )}
    </div>
  );
}

