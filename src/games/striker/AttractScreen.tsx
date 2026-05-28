import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../types';

interface AttractScreenProps {
  leaderboard: LeaderboardEntry[];
  currentUserEmail: string;
  totalPlayers: number;
  onStart: () => void;
}

/**
 * AttractScreen is a premium arcade-authentic HTML overlay
 * that runs in a cycle of two views (HIGH SCORES and HOW TO PLAY)
 * styled like a classic green CRT cabinet monitor screen.
 */
export default function AttractScreen({
  leaderboard,
  currentUserEmail,
  totalPlayers,
  onStart,
}: AttractScreenProps) {
  const [view, setView] = useState<'HIGH_SCORES' | 'HOW_TO_PLAY'>('HIGH_SCORES');
  const [opacity, setOpacity] = useState(1);

  // Auto-cycle every 8 seconds, respecting prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return; // Do not auto-cycle if reduced motion is requested
    }

    const interval = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setView((v) => (v === 'HIGH_SCORES' ? 'HOW_TO_PLAY' : 'HIGH_SCORES'));
        setOpacity(1);
      }, 200); // 200ms fade-out
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Find user's rank
  const userRankIndex = leaderboard.findIndex(
    (e) => e.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()
  );
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : -1;
  const isUserInTop3 = userRank > 0 && userRank <= 3;

  // Prepare top 3 entries
  const top3 = leaderboard.slice(0, 3);
  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div
      role="region"
      aria-label="Game attract mode"
      className="absolute inset-0 z-10 bg-black/80 flex flex-col justify-between p-4 select-none crt-text"
      style={{
        fontSize: 'clamp(9px, 2.5vw, 12px)',
      }}
    >
      {/* Self-contained CRT & blinking animation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes attract-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes attract-blink-gold {
          0%, 100% { opacity: 1; color: #FFD60A; }
          50% { opacity: 0.3; color: #FFD60A; }
        }
        .attract-blink {
          animation: attract-blink 0.8s infinite;
        }
        .attract-blink-gold {
          animation: attract-blink-gold 0.6s infinite;
        }
        .crt-text {
          font-family: 'Press Start 2P', monospace;
          color: #30D158;
          text-shadow: 0 0 4px rgba(48, 209, 88, 0.6);
        }
        .crt-text-title {
          font-size: clamp(14px, 4.5vw, 18px);
          color: #30D158;
          text-shadow: 0 0 6px rgba(48, 209, 88, 0.8);
        }
        .crt-text-divider {
          font-size: clamp(9px, 2.8vw, 12px);
          opacity: 0.7;
        }
        .crt-body-text {
          font-size: clamp(9px, 2.8vw, 11px);
        }
        .crt-footer-text {
          font-size: clamp(8px, 2.3vw, 10px);
        }
      `}} />

      {/* Screen Inner View Container */}
      <div
        className="flex-1 flex flex-col justify-between"
        style={{
          transition: 'opacity 200ms ease-in-out',
          opacity: opacity,
        }}
      >
        {/* VIEW 1: HIGH SCORES */}
        {view === 'HIGH_SCORES' && (
          <div className="flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="text-center space-y-1 mt-1">
              <h1 className="crt-text-title font-black uppercase tracking-wider">
                SKY STRIKER
              </h1>
              <div className="crt-text-divider text-emerald-500/70 tracking-widest">
                ─── HIGH SCORES ───
              </div>
            </div>

            {/* Top 3 List */}
            <div className="flex-1 flex flex-col justify-center space-y-2.5 max-w-[280px] mx-auto w-full px-1">
              {top3.length === 0 ? (
                <div className="text-center text-zinc-500 py-4 uppercase text-[10px] tracking-wider space-y-1">
                  <div>NO SCORES YET</div>
                  <div className="text-[#FFD60A] text-[9px] animate-pulse">BE THE FIRST!</div>
                </div>
              ) : (
                <>
                  {top3.map((entry, idx) => {
                    const rank = idx + 1;
                    const isMe = entry.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
                    return (
                      <div
                        key={entry.email}
                        className="flex items-center justify-between text-[11px] crt-body-text"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12px] shrink-0">{medalEmojis[idx]}</span>
                          <span
                            className={`truncate uppercase font-black ${
                              isMe ? 'text-white' : 'text-zinc-300'
                            }`}
                          >
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="crt-text-body text-[#FFD60A] font-black attract-blink-gold text-[9px] shrink-0 ml-1">
                              ◄ YOU
                            </span>
                          )}
                        </div>
                        <span className="text-emerald-400 font-bold ml-auto shrink-0 tabular-nums">
                          {entry.highScore.toLocaleString('id-ID')}
                        </span>
                      </div>
                    );
                  })}
                  {/* Fill empty slots up to 3 */}
                  {Array.from({ length: 3 - top3.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center justify-between text-[11px] crt-body-text opacity-30 text-emerald-500/40"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]">{medalEmojis[top3.length + i]}</span>
                        <span>— — — — —</span>
                      </div>
                      <span>-</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Info Muted Rank Sub-text */}
            <div className="text-center text-zinc-500/70 crt-footer-text mb-1 tracking-wider uppercase">
              {userRank > 3 ? (
                <span>YOUR RANK: #{userRank} / {totalPlayers} PLAYERS</span>
              ) : userRank > 0 ? (
                <span>TOP PERFORMER! 🏆</span>
              ) : totalPlayers > 0 ? (
                <span>RANK: UNRANKED / {totalPlayers} PLAYERS</span>
              ) : (
                <span>NO PLAYERS YET</span>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: HOW TO PLAY */}
        {view === 'HOW_TO_PLAY' && (
          <div className="flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="text-center space-y-1 mt-1">
              <h1 className="crt-text-title font-black uppercase tracking-wider">
                SKY STRIKER
              </h1>
              <div className="crt-text-divider text-emerald-500/70 tracking-widest">
                ─── HOW TO PLAY ───
              </div>
            </div>

            {/* Grid details */}
            <div className="flex-1 flex flex-col justify-center space-y-2 crt-body-text max-w-[280px] mx-auto w-full px-2 text-zinc-200">
              <div className="grid grid-cols-[115px_1fr] gap-x-2 text-[8px] leading-relaxed">
                <span className="text-[#FFD60A]">[D-PAD ←→]</span>
                <span>MOVE PLANE</span>
              </div>
              <div className="grid grid-cols-[115px_1fr] gap-x-2 text-[8px] leading-relaxed">
                <span className="text-[#FFD60A]">[A]</span>
                <span>SHOOT / HOLD</span>
              </div>
              <div className="grid grid-cols-[115px_1fr] gap-x-2 text-[8px] leading-relaxed">
                <span className="text-[#FFD60A]">[B]</span>
                <span>BOMB (3 PER GAME)</span>
              </div>

              {/* Warning guidelines */}
              <div className="pt-1.5 space-y-1 border-t border-emerald-500/10 mt-1">
                <div className="flex items-center gap-1.5 text-[8px] text-[#FF9F0A]">
                  <span className="shrink-0">⚠️</span>
                  <span className="font-bold">AVOID ENEMY FIRE</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] text-[#FF9F0A]">
                  <span className="shrink-0">⚠️</span>
                  <span className="font-bold">SURVIVE WAVES → BOSS</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Start Instruction (Shared across both views) */}
      <div className="text-center py-1 mt-auto border-t border-emerald-500/10 w-full shrink-0">
        <div
          aria-live="polite"
          className="crt-footer-text text-emerald-400 font-bold attract-blink tracking-widest flex items-center justify-center gap-1.5"
        >
          <span>▶</span>
          <span>PRESS [A] TO START</span>
        </div>
      </div>
    </div>
  );
}
