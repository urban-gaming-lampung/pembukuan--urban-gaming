/**
 * GameAudio synthesizes chiptune-like retro sound effects and loopable background music
 * using the native Web Audio API. Does not require external audio assets or dependencies.
 * Prevents throwing errors due to browser auto-play restrictions by lazy initializing
 * the AudioContext upon user gesture.
 */
class GameAudio {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private bgmIntervalId: any = null;
  private bgmStep = 0;
  
  // Melody loop (frequencies in Hz, 0 = rest)
  private bgmNotes = [
    329.63, 246.94, 261.63, 293.66, 261.63, 246.94, 220.00, 220.00,
    261.63, 329.63, 293.66, 261.63, 246.94, 261.63, 293.66, 329.63,
    261.63, 220.00, 220.00, 0
  ];

  constructor() {
    try {
      this.isMuted = localStorage.getItem('game_muted') === 'true';
    } catch (e) {
      this.isMuted = false;
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('game_muted', String(muted));
    } catch (e) {}

    if (muted) {
      this.stopBGM();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * Loops background chiptune music softly.
   */
  startBGM() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    if (this.bgmIntervalId) return;

    this.bgmStep = 0;
    const tempo = 220; // ms per step

    this.bgmIntervalId = setInterval(() => {
      if (this.isMuted || !this.ctx) {
        this.stopBGM();
        return;
      }

      const note = this.bgmNotes[this.bgmStep % this.bgmNotes.length];
      this.bgmStep++;

      if (note > 0) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle'; // triangle wave gives a soft retro bass feel
          osc.frequency.setValueAtTime(note, this.ctx.currentTime);

          gain.gain.setValueAtTime(0.012, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start();
          osc.stop(this.ctx.currentTime + 0.18);
        } catch (e) {}
      }
    }, tempo);
  }

  stopBGM() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  /**
   * Sound effect triggered when snake eats food (high pitch chime)
   */
  playEat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /**
   * Sound effect triggered on Game Over (sliding descending chiptune buzz)
   */
  playGameOver() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopBGM();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  /**
   * Soft tick sound effect triggered when snake moves
   */
  playMove() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  /**
   * Rising arpeggio chiptune for combo events (C5 → E5 → G5, 50ms each)
   */
  playCombo() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const stepDuration = 0.05; // 50ms each

    notes.forEach((freq, i) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * stepDuration);

        const startTime = this.ctx!.currentTime + i * stepDuration;
        gain.gain.setValueAtTime(0.07, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + stepDuration);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + stepDuration);
      } catch (e) {}
    });
  }

  /**
   * Triumphant ascending scale for level-up events (C4 → E4 → G4 → C5, 100ms each, square wave)
   */
  playLevelUp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const stepDuration = 0.1; // 100ms each

    notes.forEach((freq, i) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * stepDuration);

        const startTime = this.ctx!.currentTime + i * stepDuration;
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + stepDuration * 0.95);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + stepDuration);
      } catch (e) {}
    });
  }

  /**
   * Sparkle sound for power-up events (high frequency wobble 1000Hz → 2000Hz → 1000Hz, 200ms, sine wave)
   */
  playPowerUp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const duration = 0.2; // 200ms
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.linearRampToValueAtTime(2000, now + duration / 2);
      osc.frequency.linearRampToValueAtTime(1000, now + duration);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  /**
   * Victory fanfare for high-score events (C5 → E5 → G5 → hold C6 300ms, sawtooth → sine blend)
   */
  playHighScore() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const stepDuration = 0.1; // 100ms each
    const now = this.ctx.currentTime;

    // Sawtooth arpeggio lead-in
    notes.forEach((freq, i) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * stepDuration);

        const startTime = now + i * stepDuration;
        gain.gain.setValueAtTime(0.06, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + stepDuration);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(startTime);
        osc.stop(startTime + stepDuration);
      } catch (e) {}
    });

    // Sustained C6 hold with sine wave
    try {
      const holdStart = now + notes.length * stepDuration;
      const holdDuration = 0.3; // 300ms
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, holdStart); // C6

      gain.gain.setValueAtTime(0.09, holdStart);
      gain.gain.exponentialRampToValueAtTime(0.001, holdStart + holdDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(holdStart);
      osc.stop(holdStart + holdDuration);
    } catch (e) {}
  }

  /**
   * Quick coin pickup sound (E6 → B6, 80ms total, square wave, bright)
   */
  playCoin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const duration = 0.08; // 80ms
      const now = this.ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(1318.51, now); // E6
      osc.frequency.exponentialRampToValueAtTime(1975.53, now + duration); // B6

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  /**
   * Impact sound effect (white noise burst 80ms mixed with low 80Hz thump)
   */
  playHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const duration = 0.08; // 80ms
    const now = this.ctx.currentTime;

    // White noise burst
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = this.ctx.createGain();

      noiseGain.gain.setValueAtTime(0.1, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + duration);
    } catch (e) {}

    // Low frequency thump
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }
}

export const gameAudio = new GameAudio();
export default gameAudio;
