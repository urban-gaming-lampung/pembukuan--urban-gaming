import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, Play, RefreshCw, Trophy } from 'lucide-react';
import HandheldFrame from '../components/handheld/HandheldFrame';
import GameScreen from '../components/handheld/GameScreen';
import DPad from '../components/handheld/DPad';
import ActionButtons from '../components/handheld/ActionButtons';
import SystemButtons from '../components/handheld/SystemButtons';
import { useGameLoop } from '../engine/GameLoop';
import { useGameInput, GameAction } from '../engine/useGameInput';
import { useScoreSeed } from '../engine/useScoreSeed';
import { useGameSession } from '../hooks/useGameSession';
import gameAudio from '../components/handheld/audio';
import { PixelConfetti } from '../engine/confetti';
import { ScreenShake } from '../engine/screenShake';
import { strikerReducer, INITIAL_STATE, CANVAS_WIDTH, CANVAS_HEIGHT } from './strikerReducer';
import { renderStrikerGame } from './strikerRenderer';
import CurrentLeaderboard from '../components/CurrentLeaderboard';

interface StrikerGameProps {
  onClose: () => void;
  monthKey: string;
  currentHighScore: number;
  modalState?: 'MENU' | 'GAME_IDLE' | 'PLAYING' | 'GAME_OVER';
  setModalState?: (state: 'MENU' | 'GAME_IDLE' | 'PLAYING' | 'GAME_OVER') => void;
}

type GameStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SUBMITTING';

export default function StrikerGame({
  onClose,
  monthKey,
  currentHighScore,
  modalState,
  setModalState,
}: StrikerGameProps) {
  const [gameState, dispatch] = useReducer(strikerReducer, null, () => INITIAL_STATE());
  const [gameStatus, setGameStatus] = useState<GameStatus>('IDLE');
  const [frameVariant, setFrameVariant] = useState<'gray' | 'red'>('gray');
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('game_muted') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isCheated, setIsCheated] = useState<boolean>(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState<boolean>(false);
  const [submitResultMsg, setSubmitResultMsg] = useState<string>('');
  const [isNewHigh, setIsNewHigh] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedTimeRef = useRef<number>(0);
  const tabSwitchCount = useRef<number>(0);
  const isTouchActive = useRef<boolean>(false);
  const confettiRef = useRef<PixelConfetti | null>(null);
  const shakeRef = useRef(new ScreenShake());
  const warningTimerRef = useRef<number>(0);

  // Initialize anti-cheat seed and logger
  const { initSession, logAction, buildPayload, startTimeRef } = useScoreSeed();

  // Firebase session hooks
  const {
    submitScore,
    canPlay,
    attemptsLeftToday,
    loading: submitLoading,
    error: submitError,
    optimisticHighScore,
  } = useGameSession(monthKey, 'striker', currentHighScore);

  // Check if system is dark mode
  const [isDark, setIsDark] = useState<boolean>(
    document.documentElement.classList.contains('dark')
  );

  // Listen to dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Bidirectional state machine sync between parent modalState and local gameStatus
  useEffect(() => {
    if (modalState === 'GAME_IDLE' && gameStatus !== 'IDLE') {
      setGameStatus('IDLE');
    } else if (modalState === 'PLAYING' && gameStatus !== 'PLAYING') {
      setGameStatus('PLAYING');
    } else if (modalState === 'GAME_OVER' && gameStatus !== 'GAME_OVER' && gameStatus !== 'SUBMITTING') {
      setGameStatus('GAME_OVER');
    }
  }, [modalState]);

  useEffect(() => {
    if (gameStatus === 'IDLE' && modalState !== 'GAME_IDLE') {
      setModalState?.('GAME_IDLE');
    } else if (gameStatus === 'PLAYING' && modalState !== 'PLAYING') {
      setModalState?.('PLAYING');
    } else if ((gameStatus === 'GAME_OVER' || gameStatus === 'SUBMITTING') && modalState !== 'GAME_OVER') {
      setModalState?.('GAME_OVER');
    }
  }, [gameStatus, modalState, setModalState]);

  // Simple devtools detection
  const checkDevTools = () => {
    const threshold = 160;
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      setIsCheated(true);
    }
  };

  // Anti-cheat: Track tab visibility switches
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        if (tabSwitchCount.current > 5) {
          setIsCheated(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Manage BGM looping lifecycle
  useEffect(() => {
    if (gameStatus === 'PLAYING') {
      if (isMuted) {
        gameAudio.stopBGM();
      } else {
        gameAudio.startBGM();
      }
    } else {
      gameAudio.stopBGM();
    }
    return () => {
      gameAudio.stopBGM();
    };
  }, [gameStatus, isMuted]);

  // Sound Synth Helpers
  const playBeep = (freq: number, type: OscillatorType, duration: number, vol = 0.05) => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playLaserSound = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playRollSound = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(650, ctx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  };

  const playWarningSound = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  // Haptic feedback
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  };

  // Inputs handler
  const handleGameInput = (action: GameAction, isPressed: boolean) => {
    if (isPressed) {
      logAction(action);
    }

    if (gameStatus === 'GAME_OVER' && isPressed) {
      if (action === 'A') {
        handleStartPause();
      } else if (action === 'B') {
        onClose();
      }
      return;
    }

    if (gameStatus === 'IDLE' && isPressed) {
      if (action === 'A') {
        handleStartPause();
      } else if (action === 'B') {
        onClose();
      }
      return;
    }

    if (isCheated || gameStatus !== 'PLAYING') return;

    if (isPressed) {
      if (action === 'A') {
        dispatch({
          type: 'SHOOT',
          onShoot: () => {
            playLaserSound();
            vibrate(8);
          },
        });
      } else if (action === 'B') {
        dispatch({
          type: 'TRIGGER_ROLL',
          onRoll: () => {
            playRollSound();
            vibrate([20, 20, 20, 20]);
          },
        });
      }
    }
  };

  const { pressed, triggerAction } = useGameInput(handleGameInput);

  // Game physics execution loop
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameStatus === 'PLAYING' && !isCheated) {
      // 2D Movement
      const moveSpeed = 165; // pixels per second
      let dx = 0;
      let dy = 0;

      if (pressed.LEFT) dx -= 1;
      if (pressed.RIGHT) dx += 1;
      if (pressed.UP) dy -= 1;
      if (pressed.DOWN) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const ndx = (dx / len) * moveSpeed * dt;
        const ndy = (dy / len) * moveSpeed * dt;
        dispatch({ type: 'MOVE_PLAYER', dx: ndx, dy: ndy });
      }

      // Auto shoot if Button A is held down
      if (pressed.A) {
        dispatch({
          type: 'SHOOT',
          onShoot: () => {
            playLaserSound();
            vibrate(8);
          },
        });
      }

      elapsedTimeRef.current += dt * 1000;

      // Update state engine
      dispatch({
        type: 'TICK',
        dt,
        onHitEnemy: () => {
          vibrate(10);
          playBeep(280, 'triangle', 0.05, 0.03); // light hit sound
        },
        onBossHit: () => {
          vibrate(12);
          playBeep(180, 'sawtooth', 0.06, 0.04);
        },
        onScoreItem: () => {
          vibrate([30, 30]);
          gameAudio.playPowerUp();
        },
        onHitPlayer: () => {
          vibrate(250);
          playBeep(80, 'sawtooth', 0.45, 0.1); // heavy explosion sound
          shakeRef.current.trigger(8, 15);
        },
        onBossSpawn: () => {
          playWarningSound();
        },
        onStageClear: () => {
          vibrate([60, 40, 60]);
          gameAudio.playLevelUp(); // fanfare
        },
        onGameOver: () => {
          handleGameOver();
        },
        onGameWon: () => {
          // Play win scale chimes
          vibrate([80, 40, 80, 40, 150]);
          gameAudio.playHighScore();
          confettiRef.current = new PixelConfetti(ctx, canvas.width, canvas.height);
          confettiRef.current.burst(50);
          handleGameOver();
        },
      });

      // Play boss warning alert sound every 1.5 seconds if warning is flashing
      if (gameState.bossWarningTimer > 0) {
        warningTimerRef.current += dt * 1000;
        if (warningTimerRef.current >= 1000) {
          warningTimerRef.current = 0;
          playWarningSound();
        }
      } else {
        warningTimerRef.current = 0;
      }
    }

    // Render loop
    if (canvas.width !== CANVAS_WIDTH) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }

    // Apply screen shake offset
    const shakeOffset = shakeRef.current.update();
    if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
      ctx.save();
      ctx.translate(shakeOffset.x, shakeOffset.y);
    }

    renderStrikerGame(ctx, gameState, isDark, elapsedTimeRef.current, gameStatus === 'IDLE');

    if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
      ctx.restore();
    }

    // Draw confetti overlay
    if (confettiRef.current && confettiRef.current.isActive()) {
      confettiRef.current.update(dt);
      confettiRef.current.draw();
    }
  }, 60);

  // Touch screen dragging controls mapping
  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameStatus !== 'PLAYING' || isCheated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const relativeX = ((touch.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const relativeY = ((touch.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    dispatch({ type: 'PLAYER_TOUCH', x: relativeX, y: relativeY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameStatus !== 'PLAYING' || isCheated || !isTouchActive.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const relativeY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    dispatch({ type: 'PLAYER_TOUCH', x: relativeX, y: relativeY });
  };

  // Manage Game Over state & submit score
  const handleGameOver = async () => {
    setGameStatus('GAME_OVER');
    checkDevTools();

    if (isCheated) {
      vibrate(300);
      setSubmitResultMsg('Percobaan dibatalkan karena aktivitas mencurigakan.');
      return;
    }

    if (!canPlay) {
      setSubmitResultMsg('Batas bermain harian telah tercapai.');
      return;
    }

    setGameStatus('SUBMITTING');
    const payload = buildPayload(gameState.score, 'striker');

    try {
      const response = await submitScore(payload);
      if (response.success) {
        setIsSubmitSuccess(true);
        setIsNewHigh(response.isNewHighScore);
        setSubmitResultMsg(response.message);
        if (response.isNewHighScore) {
          vibrate([50, 30, 50, 30, 100]);
          gameAudio.playHighScore();
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              confettiRef.current = new PixelConfetti(ctx, canvas.width, canvas.height);
              confettiRef.current.burst(40);
            }
          }
        }
      } else {
        setIsSubmitSuccess(false);
        setSubmitResultMsg(response.message || 'Gagal menyimpan skor.');
      }
    } catch (e) {
      setIsSubmitSuccess(false);
      setSubmitResultMsg('Terjadi masalah koneksi internet.');
    }

    setGameStatus('GAME_OVER');
  };

  const handleStartPause = () => {
    if (gameStatus === 'GAME_OVER') {
      // Reset state and return to IDLE (attract mode)
      setIsSubmitSuccess(false);
      setIsNewHigh(false);
      setSubmitResultMsg('');
      elapsedTimeRef.current = 0;
      dispatch({ type: 'RESET' });
      setGameStatus('IDLE');
    } else if (gameStatus === 'IDLE') {
      if (!canPlay) {
        alert('Maaf, batas bermain harian Anda hari ini sudah habis! Kembali besok ya. 🎮');
        return;
      }
      initSession();
      tabSwitchCount.current = 0;
      setIsSubmitSuccess(false);
      setIsNewHigh(false);
      setSubmitResultMsg('');
      elapsedTimeRef.current = 0;
      dispatch({ type: 'RESET' });
      setGameStatus('PLAYING');
    } else if (gameStatus === 'PLAYING') {
      setGameStatus('PAUSED');
    } else if (gameStatus === 'PAUSED') {
      setGameStatus('PLAYING');
    }
  };

  const handleReset = () => {
    if (gameStatus === 'PLAYING' || gameStatus === 'PAUSED' || gameStatus === 'GAME_OVER') {
      if (window.confirm('Reset permainan saat ini? Skor Anda tidak akan disimpan.')) {
        dispatch({ type: 'RESET' });
        setGameStatus('IDLE');
        setIsSubmitSuccess(false);
        setIsNewHigh(false);
        setSubmitResultMsg('');
      }
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    try {
      localStorage.setItem('game_muted', String(nextMute));
    } catch (e) {}
  };

  const handleRetrySubmit = async () => {
    if (gameStatus === 'SUBMITTING' || isSubmitSuccess) return;

    setGameStatus('SUBMITTING');
    const payload = buildPayload(gameState.score, 'striker');

    try {
      const response = await submitScore(payload);
      if (response.success) {
        setIsSubmitSuccess(true);
        setIsNewHigh(response.isNewHighScore);
        setSubmitResultMsg(response.message);
      } else {
        setIsSubmitSuccess(false);
        setSubmitResultMsg(response.message);
      }
    } catch (e) {
      setIsSubmitSuccess(false);
      setSubmitResultMsg('Gagal terhubung dengan server.');
    }

    setGameStatus('GAME_OVER');
  };

  const handleBackToMenu = () => {
    if (gameStatus === 'PLAYING' || gameStatus === 'PAUSED') {
      if (!window.confirm('Sesi bermain sedang berjalan. Keluar dan hanguskan skor saat ini?')) {
        return;
      }
    }
    onClose();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-0 font-sans">
      {/* Main Console Frame */}
      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 gap-2">
        <HandheldFrame variant={frameVariant} isPowerOn={gameStatus !== 'IDLE'}>
          {/* Bezel frame Screen wrapper */}
          <div className="relative">
            <GameScreen
              canvasRef={canvasRef}
              score={gameState.score}
              highScore={optimisticHighScore}
              gameStatus={gameStatus}
              monthKey={monthKey}
              isNewHighScore={isNewHigh}
              loading={gameStatus === 'SUBMITTING' || submitLoading}
              gameType="striker"
              onStart={handleStartPause}
            />
            {/* Transparent touch handler layer */}
            <canvas
              className="absolute inset-0 z-20 cursor-pointer w-full h-full opacity-0"
              onTouchStart={(e) => {
                isTouchActive.current = true;
                handleCanvasTouch(e);
              }}
              onTouchMove={handleCanvasTouch}
              onTouchEnd={() => {
                isTouchActive.current = false;
              }}
              onMouseDown={(e) => {
                isTouchActive.current = true;
                e.preventDefault();
              }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={() => {
                isTouchActive.current = false;
              }}
              onMouseLeave={() => {
                isTouchActive.current = false;
              }}
            />
          </div>

          {/* Hardware Controls */}
          <div className="flex items-start justify-between px-2 mt-2 gap-4">
            {/* Hardware D-Pad */}
            <div className={gameStatus === 'GAME_OVER' || gameStatus === 'IDLE' ? 'opacity-50 pointer-events-none' : ''}>
              <DPad onPress={triggerAction} pressedState={pressed} disabled={gameStatus === 'GAME_OVER' || gameStatus === 'IDLE'} />
            </div>

            {/* Hardware Action Buttons (A/B) */}
            <ActionButtons onPress={triggerAction} pressedState={pressed} />
          </div>

          {/* Console System buttons (Start, Reset, Mute) */}
          <SystemButtons
            onStartPause={handleStartPause}
            onReset={handleReset}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            gameStatus={gameStatus}
          />
        </HandheldFrame>

        {/* Bottom Panel: Sisa Percobaan & Submit Overlays */}
        <div className="mt-1 w-full max-w-[460px] text-center px-4 space-y-2">
          {gameStatus === 'IDLE' && (
            <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
              Sisa Percobaan Hari Ini: <span className="text-zinc-800 dark:text-zinc-200 font-bold">{attemptsLeftToday}</span>
            </div>
          )}

          {/* Cheated warning */}
          {isCheated && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
              ⚠️ Aktivitas tidak wajar terdeteksi. Sesi dibatalkan.
            </div>
          )}

          {/* Score Submission Stats Card */}
          {gameStatus === 'GAME_OVER' && submitResultMsg && (
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${isSubmitSuccess ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 font-sans">
                    {isSubmitSuccess ? 'Hasil Pengiriman Skor' : 'Skor Gagal Dikirim'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-sans">
                    {submitResultMsg}
                  </p>
                </div>
              </div>

              {/* Show retry if submit failed */}
              {!isSubmitSuccess && !submitLoading && (
                <button
                  onClick={handleRetrySubmit}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all font-sans"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kirim Ulang Skor
                </button>
              )}

              {/* Action Buttons to Play Again or Go Back */}
              <div className="flex gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  onClick={handleStartPause}
                  disabled={attemptsLeftToday <= 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-500/15 font-sans"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Main Lagi
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all font-sans"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
