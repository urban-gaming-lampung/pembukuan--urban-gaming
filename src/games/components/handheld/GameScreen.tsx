import React, { useState, useEffect } from 'react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { auth } from '../../../lib/firebase';
import RankBadge from '../RankBadge';
import AttractScreen from '../../striker/AttractScreen';

interface GameScreenProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  score: number;
  highScore: number;
  showCrt?: boolean;
  loading?: boolean;
  gameStatus: 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SUBMITTING';
  monthKey?: string;
  isNewHighScore?: boolean;
  gameType?: string;
  onStart?: () => void;
}

/**
 * Helper component to count score from 0 to targetScore using easeOutQuad
 */
function CountingScore({ targetScore }: { targetScore: number }) {
  const [currentScore, setCurrentScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // 800ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      setCurrentScore(Math.floor(easeProgress * targetScore));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCurrentScore(targetScore);
      }
    };

    const animFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animFrame);
  }, [targetScore]);

  return <span>{currentScore.toLocaleString('id-ID')}</span>;
}

/**
 * GameScreen wraps the HTML5 canvas with a retro LCD green screen bezel,
 * CRT scanline textures, and dynamic overlay screens for game states.
 */
function GameScreen({
  canvasRef,
  score,
  highScore,
  showCrt = true,
  loading = false,
  gameStatus,
  monthKey,
  isNewHighScore = false,
  gameType,
  onStart,
}: GameScreenProps) {
  const { entries } = useLeaderboard(monthKey || '');
  const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim() || '';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (gameStatus === 'GAME_OVER') {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [gameStatus]);

  // Find user rank
  const userRank = entries.findIndex((e) => e.email.toLowerCase().trim() === currentUserEmail) + 1;

  // Prepare top 5 entries
  const top5 = [...entries.slice(0, 5)];
  while (top5.length < 5) {
    top5.push(null as any);
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-8 border-zinc-900 dark:border-zinc-950 bg-[#0c180c] shadow-inner select-none">
      {/* Outer border bevel overlay */}
      <div className="absolute inset-0 border border-black/40 pointer-events-none z-30" />

      {/* Screen HUD Overlay */}
      {gameStatus !== 'GAME_OVER' && (
        <div className="absolute top-0 inset-x-0 bg-black/40 px-3 py-1 flex items-center justify-between text-emerald-400 font-pixel text-[8px] tracking-wider z-20 border-b border-emerald-500/10">
          <div>SCORE: <span className="text-white font-black">{score}</span></div>
          <div>HI: <span className="text-white font-black">{highScore}</span></div>
        </div>
      )}

      {/* Canvas viewport container */}
      <div className="relative w-full aspect-[4/3] bg-[#8bac0f] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full block image-render-pixelated"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* CRT Scanline Overlay */}
        {showCrt && (
          <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.08)_50%)] bg-[length:100%_4px]" />
        )}

        {/* CRT Vignette/Inset Shadow Overlay */}
        {showCrt && (
          <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.55)]" />
        )}

        {/* Submitting state overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 z-40 text-emerald-400 font-pixel">
            <svg className="animate-spin h-5 w-5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-[8px] tracking-wider">SAVING SCORE...</span>
          </div>
        )}

        {/* Start Game screen overlay */}
        {gameStatus === 'IDLE' && (
          gameType === 'striker' ? (
            <AttractScreen
              leaderboard={entries}
              currentUserEmail={currentUserEmail}
              totalPlayers={entries.length}
              onStart={onStart || (() => {})}
            />
          ) : (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 z-10 text-white font-pixel text-center px-4">
              <h3 className="text-emerald-400 text-[11px] tracking-widest animate-pulse">PRESS START</h3>
              <p className="text-[7px] text-zinc-400 leading-relaxed max-w-[200px] uppercase">
                Gunakan D-Pad atau Keyboard (W,A,S,D / Arah) untuk mengendalikan
              </p>
            </div>
          )
        )}

        {/* Paused screen overlay */}
        {gameStatus === 'PAUSED' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 text-amber-400 font-pixel text-[11px] tracking-widest">
            PAUSE
          </div>
        )}

        {/* Game Over screen overlay - mini leaderboard inside handheld */}
        {gameStatus === 'GAME_OVER' && (
          <div
            className={`absolute inset-0 bg-[#0c180c] flex flex-col justify-between p-3 text-emerald-400 font-pixel z-10 select-none transition-opacity duration-300 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Header & Score */}
            <div className="flex flex-col items-center">
              <h3 className="text-red-500 text-[12px] font-bold tracking-widest uppercase animate-pulse">
                GAME OVER
              </h3>
              <div className="text-white text-[9px] mt-1 tracking-wide">
                SCORE: <CountingScore targetScore={score} />
              </div>
              <div className="text-[7px] text-[#FFD700] mt-0.5 tracking-wider">
                {userRank > 0 ? (
                  <span>
                    RANK: #{userRank}{' '}
                    {isNewHighScore ? (
                      <span className="text-red-500 animate-pulse">/ NEW HIGH SCORE!</span>
                    ) : (
                      ''
                    )}
                  </span>
                ) : (
                  'RANK: -'
                )}
              </div>
            </div>

            {/* Top 5 Leaderboard */}
            <div className="flex-1 flex flex-col justify-center my-1.5 space-y-1">
              <div className="text-[6px] text-zinc-500 text-center uppercase tracking-widest">
                ── TOP 5 ──
              </div>

              {top5.map((entry, idx) => {
                const rank = idx + 1;
                if (!entry) {
                  return (
                    <div
                      key={`empty-${rank}`}
                      className="flex items-center w-full px-2 py-0.5 text-[8px] opacity-40"
                    >
                      <div className="shrink-0 flex items-center justify-center">
                        <RankBadge rank={rank} size="sm" />
                      </div>
                      <span className="ml-2 font-sans font-bold text-zinc-500">...</span>
                      <span className="ml-auto text-zinc-600">-</span>
                    </div>
                  );
                }

                const isMe = entry.email.toLowerCase().trim() === currentUserEmail;
                return (
                  <div
                    key={entry.email}
                    className={`flex items-center w-full px-2 py-0.5 rounded ${
                      isMe
                        ? 'bg-emerald-500/10 border-b border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                        : ''
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="shrink-0">
                      <RankBadge rank={rank} size="sm" />
                    </div>

                    {/* Name (Standard Font) */}
                    <span
                      className={`font-sans font-bold uppercase truncate max-w-[120px] text-[9px] ml-2 ${
                        isMe ? 'text-emerald-400 font-extrabold' : 'text-zinc-100'
                      }`}
                    >
                      {entry.name}
                    </span>

                    {/* Score (Pixel Font) */}
                    <span
                      className={`font-pixel text-[8px] ml-auto ${
                        isMe ? 'text-emerald-400 font-black' : 'text-zinc-300'
                      }`}
                    >
                      {entry.highScore.toLocaleString('id-ID')}
                    </span>

                    {/* Blinking indicator for current user */}
                    {isMe && (
                      <span className="text-emerald-400 font-pixel text-[7px] animate-pulse ml-1 shrink-0">
                        ←
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Interactive Physical Buttons Legend */}
            <div className="flex items-center justify-between text-[6px] border-t border-emerald-500/20 pt-1 font-pixel text-zinc-500">
              <div>
                <span className="text-emerald-400">[A]</span> MAIN LAGI
              </div>
              <div>
                <span className="text-emerald-400">[B]</span> KELUAR
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(GameScreen);

