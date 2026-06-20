import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, Play, RefreshCw, Trophy, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { stackReducer, INITIAL_STATE } from './stackReducer';
import { renderStackGame } from './stackRenderer';
import CurrentLeaderboard from '../components/CurrentLeaderboard';


interface StackGameProps {
  onClose: () => void;
  monthKey: string;
  currentHighScore: number;
}

type GameStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SUBMITTING';

export default function StackGame({ onClose, monthKey, currentHighScore }: StackGameProps) {
  const [gameState, dispatch] = useReducer(stackReducer, null, INITIAL_STATE);
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
  const accumulatorRef = useRef<number>(0);
  const tabSwitchCount = useRef<number>(0);
  const confettiRef = useRef<PixelConfetti | null>(null);
  const shakeRef = useRef(new ScreenShake());

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
  } = useGameSession(monthKey, 'stack', currentHighScore);

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

  // Immersive sound play chiptune helper with dual-detuned oscillators and panning
  const playBeep = (freq: number, type: OscillatorType, duration: number, vol = 0.18) => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(vol, now);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      let outputNode: AudioNode = mainGain;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        const randomPan = Math.random() * 0.4 - 0.2;
        panner.pan.setValueAtTime(randomPan, now);
        mainGain.connect(panner);
        outputNode = panner;
      }
      outputNode.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = type;
      osc1.frequency.setValueAtTime(freq, now);
      osc1.connect(mainGain);
      osc1.start(now);
      osc1.stop(now + duration);

      const osc2 = ctx.createOscillator();
      osc2.type = type === 'sine' ? 'square' : type;
      osc2.detune.setValueAtTime(10, now);
      osc2.frequency.setValueAtTime(freq, now);
      osc2.connect(mainGain);
      osc2.start(now);
      osc2.stop(now + duration);
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

  // Handle gameplay keyboard/touch inputs
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

    if (isCheated || gameStatus !== 'PLAYING') return;

    if (isPressed) {
      switch (action) {
        case 'LEFT':
          dispatch({ type: 'MOVE_LEFT' });
          playBeep(261.63, 'sine', 0.05, 0.08); // C4 short shift sound
          break;
        case 'RIGHT':
          dispatch({ type: 'MOVE_RIGHT' });
          playBeep(261.63, 'sine', 0.05, 0.08); // C4 short shift sound
          break;
        case 'UP':
          dispatch({ type: 'ROTATE' });
          playBeep(329.63, 'triangle', 0.08, 0.10); // E4 rotation sound
          break;
        case 'A':
          dispatch({
            type: 'HARD_DROP',
            onLock: () => {
              vibrate(15);
              playBeep(180, 'triangle', 0.1, 0.18);
            },
            onLineClear: (count) => {
              vibrate(50);
              // Clear chimes
              playBeep(587.33, 'sine', 0.1, 0.18); // D5
              setTimeout(() => playBeep(880, 'sine', 0.2, 0.18), 80); // A5
            },
            onGameOver: () => {
              vibrate(200);
              playBeep(120, 'sawtooth', 0.4, 0.28);
              handleGameOver();
            },
          });
          break;
        case 'B':
          dispatch({ type: 'HOLD' });
          playBeep(440, 'sine', 0.1, 0.15); // A4 hold sound
          break;
      }
    }
  };

  const { pressed, triggerAction } = useGameInput(handleGameInput);

  // Game execution tick
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gameStatus === 'PLAYING' && !isCheated) {
      elapsedTimeRef.current += dt * 1000;
      accumulatorRef.current += dt * 1000;

      // Soft drop speeds up gravity tick rate significantly
      const tickInterval = pressed.DOWN ? Math.min(50, gameState.speed / 10) : gameState.speed;

      if (accumulatorRef.current >= tickInterval) {
        accumulatorRef.current = 0;

        dispatch({
          type: 'MOVE_DOWN',
          onLock: () => {
            playBeep(180, 'triangle', 0.1, 0.18);
          },
          onLineClear: (count) => {
            vibrate(50);
            playBeep(587.33, 'sine', 0.1, 0.18);
            setTimeout(() => playBeep(880, 'sine', 0.2, 0.18), 80);
          },
          onGameOver: () => {
            vibrate(200);
            playBeep(120, 'sawtooth', 0.4, 0.28);
            handleGameOver();
          },
        });
      }
    }

    // Render loop
    if (canvas.width !== 400) {
      canvas.width = 400;
      canvas.height = 300;
    }

    // Apply screen shake offset
    const shakeOffset = shakeRef.current.update();
    if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
      ctx.save();
      ctx.translate(shakeOffset.x, shakeOffset.y);
    }

    renderStackGame(ctx, gameState, isDark, elapsedTimeRef.current);

    if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
      ctx.restore();
    }

    // Draw confetti overlay
    if (confettiRef.current && confettiRef.current.isActive()) {
      confettiRef.current.update(dt);
      confettiRef.current.draw();
    }
  }, 60);

  // Score submission
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
    const payload = buildPayload(gameState.score, 'stack');

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
    if (gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') {
      if (!canPlay) {
        alert('Maaf, batas bermain harian Anda hari ini sudah habis! Kembali besok ya.');
        return;
      }
      initSession();
      tabSwitchCount.current = 0;
      setIsSubmitSuccess(false);
      setIsNewHigh(false);
      setSubmitResultMsg('');
      elapsedTimeRef.current = 0;
      accumulatorRef.current = 0;
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
    const payload = buildPayload(gameState.score, 'stack');

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
    <div className="flex flex-col items-center w-full h-full min-h-0 font-sans">
      {/* Top Section: Toolbar */}
      <div className="w-full max-w-[460px] flex flex-col min-h-0 shrink-0">
        {/* Handheld Header Toolbar */}
        <div className="w-full flex items-center justify-between px-2 pt-1 font-sans">
          <button
            onClick={handleBackToMenu}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors font-sans"
            aria-label="Kembali ke Menu"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>

          {/* Frame Variant Switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFrameVariant('gray')}
              className={`w-4 h-4 rounded-full border border-zinc-400/30 ${
                frameVariant === 'gray' ? 'bg-zinc-500 ring-2 ring-emerald-500' : 'bg-zinc-300'
              }`}
              title="Casing Gray"
            />
            <button
              onClick={() => setFrameVariant('red')}
              className={`w-4 h-4 rounded-full border border-zinc-400/30 ${
                frameVariant === 'red' ? 'bg-red-600 ring-2 ring-emerald-500' : 'bg-red-400'
              }`}
              title="Casing Red"
            />
          </div>
        </div>
      </div>

      {/* Bottom Section: Leaderboard + Console & Status cards */}
      <div className="w-full flex-1 flex flex-col items-center justify-end mt-auto pb-1 min-h-0 gap-2">
        {/* Small Leaderboard (Only shown in IDLE state) */}
        {gameStatus === 'IDLE' && (
          <div className="w-full max-w-[460px] flex-1 overflow-y-auto scrollbar-thin rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/20 dark:bg-black/10 min-h-0">
            <CurrentLeaderboard monthKey={monthKey} />
          </div>
        )}

        {/* Main Console Frame */}
        <HandheldFrame variant={frameVariant} isPowerOn={gameStatus !== 'IDLE'}>
          {/* CRT screen view */}
          <GameScreen
            canvasRef={canvasRef}
            score={gameState.score}
            highScore={optimisticHighScore}
            gameStatus={gameStatus}
            monthKey={monthKey}
            isNewHighScore={isNewHigh}
            loading={gameStatus === 'SUBMITTING' || submitLoading}
          />

          {/* Hardware Controls */}
          <div className="flex items-start justify-between px-2 mt-2 gap-4">
            {/* Hardware D-Pad */}
            <div className={gameStatus === 'GAME_OVER' ? 'opacity-50 pointer-events-none' : ''}>
              <DPad onPress={triggerAction} pressedState={pressed} />
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
        <div className="mt-3 w-full max-w-[460px] text-center px-4 space-y-2">
          {gameStatus === 'IDLE' && (
            <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 font-sans">
              Sisa Percobaan Hari Ini: <span className="text-zinc-800 dark:text-zinc-200 font-bold">{attemptsLeftToday}</span>
            </div>
          )}

          {/* Cheated warning */}
          {isCheated && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium font-sans flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Aktivitas tidak wajar terdeteksi. Sesi dibatalkan.</span>
            </div>
          )}

          {/* Score Submission Stats Card */}
          {gameStatus === 'GAME_OVER' && submitResultMsg && (
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left space-y-3 font-sans">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  {isSubmitSuccess ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0 font-sans">
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight font-sans">
                    {isSubmitSuccess ? 'Skor Berhasil Dikirim!' : 'Pengiriman Gagal'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-sans">
                    {submitResultMsg}
                  </p>
                </div>
              </div>

              {/* Rank-up Medal Indicator */}
              {isSubmitSuccess && isNewHigh && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                  <Trophy className="h-4 w-4 animate-bounce shrink-0" />
                  <span>Skor Terbaik Baru Anda Tercapai!</span>
                </div>
              )}

              <div className="flex gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                {/* Retry submission on network failure */}
                {!isSubmitSuccess && !isCheated && (
                  <button
                    onClick={handleRetrySubmit}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 focus:outline-none font-sans"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Kirim Ulang</span>
                  </button>
                )}
                
                <button
                  onClick={handleStartPause}
                  disabled={!canPlay || isCheated}
                  className={`flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition-colors text-white font-bold text-xs flex items-center justify-center gap-1 focus:outline-none font-sans ${
                    !canPlay || isCheated ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Main Lagi</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
