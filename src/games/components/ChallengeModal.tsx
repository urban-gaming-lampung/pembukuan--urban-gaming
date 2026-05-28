import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useGameConfig } from '../hooks/useGameConfig';
import { useLeaderboard } from '../hooks/useLeaderboard';
import PrevWinnerCard from './PrevWinnerCard';
import CurrentLeaderboard from './CurrentLeaderboard';
import PlayButton from './PlayButton';
import GameRulesAccordion from './GameRulesAccordion';
import SnakeGame from '../snake/SnakeGame';
import BreakerGame from '../breaker/BreakerGame';
import StackGame from '../stack/StackGame';
import InvadersGame from '../invaders/InvadersGame';
import RunnerGame from '../runner/RunnerGame';
import StrikerGame from '../striker/StrikerGame';
import IOSAlert from './iOSAlert';
import { getPrevMonthKey, getMonthKey } from '../utils/monthKey';
import { db, auth } from '../../lib/firebase';
import { GameType } from '../types';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ChallengeModal component representing an iOS-style bottom sheet.
 * Consolidates challenge configurations, previous winners, current rankings, and play launch trigger.
 */
const formatNumberInput = (val: string) => {
  if (!val) return '';
  const num = parseInt(val, 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('id-ID');
};

const gameNamesId: Record<GameType, string> = {
  snake: 'Ular Klasik (Snake)',
  breaker: 'Penghancur Bata (Brick Breaker)',
  invaders: 'Penjajah Luar Angkasa (Space Invaders)',
  stack: 'Tumpuk Balok (Stack)',
  runner: 'Pelari Tak Terbatas (Endless Runner)',
  striker: 'Sky Striker',
};

export type ModalState = 'MENU' | 'GAME_IDLE' | 'PLAYING' | 'GAME_OVER';

export default function ChallengeModal({ isOpen, onClose }: ChallengeModalProps) {
  const { config: firestoreConfig, loading: configLoading } = useGameConfig();
  const [modalState, setModalState] = useState<ModalState>('MENU');
  const [updatingConfig, setUpdatingConfig] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [localAttempts, setLocalAttempts] = useState<string>('10');
  const [localPrize, setLocalPrize] = useState<string>('50000');

  const [alertOpen, setAlertOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);

  useEffect(() => {
    if (firestoreConfig) {
      setLocalAttempts(String(firestoreConfig.maxAttempts ?? 10));
      setLocalPrize(String(firestoreConfig.prizeAmount ?? 50000));
    }
  }, [firestoreConfig]);

  // Fallback config when Firestore doc doesn't exist yet
  const config = firestoreConfig || {
    activeGame: 'snake' as const,
    monthKey: getMonthKey(),
    rotationIndex: 0,
    lastRotated: Date.now(),
    prizeAmount: 50000,
    maxAttempts: 10,
  };

  const monthKey = config.monthKey;
  const { currentUserEntry } = useLeaderboard(monthKey);
  const currentUserHighScore = currentUserEntry?.highScore || 0;
  const isOwner = auth.currentUser?.email?.toLowerCase().trim() === 'owner@gmail.com';

  const handleSelectGame = (game: GameType) => {
    if (game === activeGame) return; // No change needed
    setSelectedGame(game);
    setAlertOpen(true);
  };

  const confirmSelectGame = async () => {
    if (!selectedGame) return;
    setAlertOpen(false);
    setUpdatingConfig(true);
    try {
      const docRef = doc(db, 'data', 'game_config');

      // Leaderboard entries remain in database under UAT rules (no delete query)
      if (!firestoreConfig) {
        // Document does not exist yet, write the full default config with activeGame overridden
        await setDoc(docRef, {
          activeGame: selectedGame,
          monthKey: getMonthKey(),
          rotationIndex: 0,
          lastRotated: Date.now(),
          prizeAmount: 50000,
        });
      } else {
        // Document exists, only update activeGame
        await setDoc(docRef, { activeGame: selectedGame }, { merge: true });
      }
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui game aktif.');
    } finally {
      setUpdatingConfig(false);
      setSelectedGame(null);
    }
  };


  // Esc key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalState === 'PLAYING') {
          // Prevent closing modal when playing, let game component handle back-safeguard
          return;
        }
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, modalState]);

  if (!isOpen) return null;

  const activeGame = config?.activeGame || 'snake';
  const prevMonthKey = monthKey ? getPrevMonthKey(monthKey) : '';

  const handleBackdropClick = () => {
    if (modalState === 'PLAYING') {
      if (window.confirm('Sesi bermain sedang berjalan. Keluar dan hanguskan skor saat ini?')) {
        setModalState('MENU');
      }
    } else if (modalState !== 'MENU') {
      setModalState('MENU');
    } else {
      onClose();
    }
  };

  const handleCloseClick = () => {
    if (modalState === 'PLAYING') {
      if (window.confirm('Sesi bermain sedang berjalan. Keluar dan hanguskan skor saat ini?')) {
        setModalState('MENU');
      }
    } else if (modalState !== 'MENU') {
      setModalState('MENU');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center font-sans p-0 md:p-4" style={{ paddingBottom: 0 }}>
      {/* Backdrop with dim & blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={handleBackdropClick}
      />

      {/* Bottom Sheet Container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative z-10 flex w-full max-w-[470px] flex-col rounded-none md:rounded-[24px] border-t md:border border-zinc-200/80 bg-white/95 dark:bg-[#1C1C1E]/95 dark:border-zinc-800/80 shadow-2xl backdrop-blur-2xl transition-all duration-300 transform translate-y-0 overflow-hidden animate-in slide-in-from-bottom duration-300 focus:outline-none pb-safe ${
          activeGame === 'striker' && modalState !== 'MENU'
            ? 'h-[90vh] max-h-[90vh] md:h-[90vh] md:max-h-[90vh]'
            : 'h-[100dvh] max-h-[100dvh] md:h-[95vh] md:max-h-[95vh]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* iOS Drag Handle */}
        <div 
          className="mx-auto my-3 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700/80 cursor-pointer md:hidden animate-pulse" 
          onClick={handleCloseClick} 
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pb-2">
          <h2 id="modal-title" className="text-xl font-black text-zinc-900 dark:text-white tracking-tight animate-in fade-in duration-200">
            {modalState !== 'MENU' 
              ? (activeGame === 'breaker' ? 'Bermain Brick Breaker' : activeGame === 'stack' ? 'Bermain Stack Master' : activeGame === 'invaders' ? 'Bermain Space Invaders' : activeGame === 'runner' ? 'Bermain Neon Runner' : activeGame === 'striker' ? 'Bermain Sky Striker' : 'Bermain Ular Klasik') 
              : 'Challenge Bulan Ini'}
          </h2>
          <button
            onClick={handleCloseClick}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Tutup modal tantangan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalState !== 'MENU' ? (
          <div className={`flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 ${activeGame === 'striker' ? 'px-4 py-2' : 'px-4 pb-4'}`}>
            {activeGame === 'breaker' ? (
              <BreakerGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
              />
            ) : activeGame === 'stack' ? (
              <StackGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
              />
            ) : activeGame === 'invaders' ? (
              <InvadersGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
              />
            ) : activeGame === 'runner' ? (
              <RunnerGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
              />
            ) : activeGame === 'striker' ? (
              <StrikerGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
                modalState={modalState}
                setModalState={setModalState}
              />
            ) : (
              <SnakeGame
                onClose={() => setModalState('MENU')}
                monthKey={monthKey}
                currentHighScore={currentUserHighScore}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-6 scrollbar-thin animate-in fade-in slide-in-from-left-4 duration-300">
            {configLoading ? (
              <div className="flex h-64 items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <>
                {/* 1. Current Leaderboard */}
                {monthKey && (
                  <CurrentLeaderboard monthKey={monthKey} />
                )}

                {/* 1.5. Total Hadiah (Repositioned below Leaderboard as a compact row) */}
                {config && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-705 dark:text-amber-400 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <span className="text-xs font-bold">Total Hadiah Bulan Ini</span>
                    </div>
                    <span className="font-pixel text-[11px] font-black text-amber-600 dark:text-amber-400">
                      Rp {(config.prizeAmount ?? 50000).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* 2. Play Button */}
                {config && (
                  <PlayButton 
                    gameType={activeGame} 
                    monthKey={monthKey} 
                    onClick={() => {
                      if (activeGame === 'striker') {
                        setModalState('GAME_IDLE');
                      } else {
                        setModalState('PLAYING');
                      }
                    }}
                  />
                )}

                 {/* 3. Game Rules Accordion */}
                {config && (
                  <GameRulesAccordion gameType={activeGame} />
                )}

                {/* 4. Owner Game Control Panel */}
                {isOwner && (
                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-3 mt-4 font-sans">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                        🕹️ Game Config (Owner Only)
                      </h3>
                      {updatingConfig && (
                        <span className="text-[10px] text-emerald-500 font-semibold animate-pulse">
                          Menyimpan...
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed font-sans">
                      Ubah game aktif bulan ini secara manual. Sistem otomatis akan tetap melakukan rotasi game di awal bulan berikutnya.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(['snake', 'breaker', 'invaders', 'stack', 'runner', 'striker'] as const).map((game) => {
                        const isActive = activeGame === game;
                        return (
                          <button
                            key={game}
                            disabled={updatingConfig}
                            onClick={() => handleSelectGame(game)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              isActive
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                                : 'bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                            }`}
                          >
                            {gameNamesId[game].split(' (')[0]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Settings for Attempt Limit and Cash Prize */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex gap-4">
                        {/* Batas Percobaan */}
                        <div className="flex-1 flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            🎯 Batas Percobaan Harian
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={localAttempts}
                            onChange={(e) => setLocalAttempts(e.target.value)}
                            onBlur={async () => {
                              let numVal = parseInt(localAttempts, 10);
                              if (isNaN(numVal) || numVal < 1) {
                                numVal = 1;
                              } else if (numVal > 50) {
                                numVal = 50;
                              }
                              setLocalAttempts(String(numVal));
                              
                              if (numVal !== firestoreConfig?.maxAttempts) {
                                setUpdatingConfig(true);
                                try {
                                  const docRef = doc(db, 'data', 'game_config');
                                  await setDoc(docRef, { maxAttempts: numVal }, { merge: true });
                                } catch (err) {
                                  console.error(err);
                                  alert('Gagal memperbarui batas percobaan.');
                                } finally {
                                  setUpdatingConfig(false);
                                }
                              }
                            }}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/85 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                          />
                        </div>

                        {/* Nominal Hadiah (Rupiah) */}
                        <div className="flex-1 flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            💰 Nominal Hadiah (Rp)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 dark:text-zinc-500 font-sans">
                              Rp
                            </span>
                            <input
                              type="text"
                              value={formatNumberInput(localPrize)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/\D/g, '');
                                setLocalPrize(cleanVal);
                              }}
                              onBlur={async () => {
                                let numVal = parseInt(localPrize, 10);
                                if (isNaN(numVal) || numVal < 0) {
                                  numVal = 0;
                                }
                                setLocalPrize(String(numVal));

                                if (numVal !== firestoreConfig?.prizeAmount) {
                                  setUpdatingConfig(true);
                                  try {
                                    const docRef = doc(db, 'data', 'game_config');
                                    await setDoc(docRef, { prizeAmount: numVal }, { merge: true });
                                  } catch (err) {
                                    console.error(err);
                                    alert('Gagal memperbarui nominal hadiah.');
                                  } finally {
                                    setUpdatingConfig(false);
                                  }
                                }
                              }}
                              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/85 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Previous Winner Card */}
                {prevMonthKey && <PrevWinnerCard prevMonthKey={prevMonthKey} />}

              </>
            )}
          </div>
        )}
      </div>

      {/* Styled IOSAlert Confirmation Dialog for owner active game selection updates */}
      <IOSAlert
        isOpen={alertOpen}
        title="Ganti Game Aktif"
        body={
          <span>
            Apakah Anda yakin ingin mengganti game tantangan bulan ini menjadi{' '}
            <strong className="font-bold text-zinc-950 dark:text-white font-sans">
              {selectedGame ? gameNamesId[selectedGame].split(' (')[0] : ''}
            </strong>
            ? Skor leaderboard pegawai saat ini tetap dipertahankan.
          </span>
        }
        cancelLabel="Batal"
        confirmLabel="Ganti"
        onCancel={() => {
          setAlertOpen(false);
          setSelectedGame(null);
        }}
        onConfirm={confirmSelectGame}
      />
    </div>
  );
}
