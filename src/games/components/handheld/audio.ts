/**
 * GameAudio synthesizes chiptune-like retro sound effects and loopable background music
 * using the native Web Audio API. Does not require external audio assets or dependencies.
 * Prevents throwing errors due to browser auto-play restrictions by lazy initializing
 * the AudioContext upon user gesture.
 * 
 * Features spatial stereo delay reverb, dual-oscillator detune synthesis (for fat sounds),
 * and balanced, normal volume levels (boosted ~3x from original whispers).
 */
class GameAudio {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private bgmIntervalId: any = null;
  private bgmStep = 0;
  
  // Delay/reverb nodes for spatial feedback loop
  private delayNode: DelayNode | null = null;
  private feedbackNode: GainNode | null = null;
  
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
        
        // Setup a retro delay feedback loop for spatial echo/reverb
        try {
          this.delayNode = this.ctx.createDelay(1.0);
          this.feedbackNode = this.ctx.createGain();
          
          this.delayNode.delayTime.setValueAtTime(0.15, this.ctx.currentTime); // 150ms delay
          this.feedbackNode.gain.setValueAtTime(0.25, this.ctx.currentTime); // 25% feedback reflection
          
          // Connect feedback loop: delay -> feedback -> delay
          this.delayNode.connect(this.feedbackNode);
          this.feedbackNode.connect(this.delayNode);
          
          // Connect delay wet output to main destination
          this.delayNode.connect(this.ctx.destination);
        } catch (e) {
          console.warn("Failed to initialize spatial delay loop:", e);
        }
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
   * Helper to synthesize fat retro sounds using detuned dual oscillators,
   * stereo panning, and routing to the feedback delay reverb loop.
   */
  private playSpatialChiptune({
    frequency,
    type1 = 'square',
    type2 = 'sawtooth',
    duration,
    volume = 0.1,
    pan = 0.0,
    sendToDelay = true,
    frequencyEnd = null,
  }: {
    frequency: number;
    type1?: OscillatorType;
    type2?: OscillatorType;
    duration: number;
    volume?: number;
    pan?: number;
    sendToDelay?: boolean;
    frequencyEnd?: number | null;
  }) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // Main Gain Envelope (ADSR quick attack and exponential decay)
      const mainGain = this.ctx.createGain();
      mainGain.gain.setValueAtTime(volume, now);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Connect dry signal through stereo panner if available
      let outputNode: AudioNode = mainGain;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        mainGain.connect(panner);
        outputNode = panner;
      }

      outputNode.connect(this.ctx.destination);

      // Route wet signal to global delay feedback loop
      if (sendToDelay && this.delayNode) {
        const wetGain = this.ctx.createGain();
        wetGain.gain.setValueAtTime(volume * 0.45, now); // send 45% of signal to delay reverb
        mainGain.connect(wetGain);
        wetGain.connect(this.delayNode);
      }

      // Primary Oscillator
      const osc1 = this.ctx.createOscillator();
      osc1.type = type1;
      osc1.frequency.setValueAtTime(frequency, now);
      if (frequencyEnd !== null) {
        osc1.frequency.exponentialRampToValueAtTime(frequencyEnd, now + duration);
      }
      osc1.connect(mainGain);
      osc1.start(now);
      osc1.stop(now + duration);

      // Secondary Detuned Oscillator (+10 cents) for thick stereo chorus-like sound
      const osc2 = this.ctx.createOscillator();
      osc2.type = type2;
      osc2.detune.setValueAtTime(10, now);
      osc2.frequency.setValueAtTime(frequency, now);
      if (frequencyEnd !== null) {
        osc2.frequency.exponentialRampToValueAtTime(frequencyEnd, now + duration);
      }
      osc2.connect(mainGain);
      osc2.start(now);
      osc2.stop(now + duration);

    } catch (e) {
      console.warn("Failed playing spatial chiptune:", e);
    }
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
        // Soft retro bass line, panned slightly left (-0.15) to keep screen center free for sfx
        this.playSpatialChiptune({
          frequency: note,
          type1: 'triangle',
          type2: 'sine',
          duration: 0.18,
          volume: 0.045, // Boosted from 0.012 for clear audibility
          pan: -0.15,
          sendToDelay: false
        });
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
   * Sound effect triggered when snake eats food (high pitch chime panned right)
   */
  playEat() {
    this.playSpatialChiptune({
      frequency: 523.25, // C5
      frequencyEnd: 880, // A5
      type1: 'sine',
      type2: 'square',
      duration: 0.15,
      volume: 0.22, // Boosted from 0.08
      pan: 0.35,
      sendToDelay: true
    });
  }

  /**
   * Sound effect triggered on Game Over (sliding descending chiptune buzz)
   */
  playGameOver() {
    if (this.isMuted) return;
    this.initCtx();
    this.stopBGM();

    // Slow dramatic sliding descent, fat sawtooth+square blend
    this.playSpatialChiptune({
      frequency: 320,
      frequencyEnd: 70,
      type1: 'sawtooth',
      type2: 'square',
      duration: 0.65,
      volume: 0.28, // Boosted from 0.12
      pan: 0.0,
      sendToDelay: true
    });
  }

  /**
   * Soft tick sound effect triggered when snake moves
   */
  playMove() {
    // Quick tick sound with slight alternating stereo panning
    const panOffset = Math.random() * 0.4 - 0.2;
    this.playSpatialChiptune({
      frequency: 135,
      type1: 'triangle',
      type2: 'sine',
      duration: 0.05,
      volume: 0.08, // Boosted from 0.02
      pan: panOffset,
      sendToDelay: false
    });
  }

  /**
   * Rising arpeggio chiptune for combo events (C5 → E5 → G5, panned across stereo field)
   */
  playCombo() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const stepDuration = 0.05;

    notes.forEach((freq, i) => {
      setTimeout(() => {
        const pan = -0.3 + (i * 0.3); // sweeps left to right
        this.playSpatialChiptune({
          frequency: freq,
          type1: 'square',
          type2: 'sawtooth',
          duration: stepDuration,
          volume: 0.18, // Boosted from 0.07
          pan: pan,
          sendToDelay: true
        });
      }, i * stepDuration * 1000);
    });
  }

  /**
   * Triumphant ascending scale for level-up events (C4 → E4 → G4 → C5, square wave)
   */
  playLevelUp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const stepDuration = 0.09;

    notes.forEach((freq, i) => {
      setTimeout(() => {
        const pan = -0.4 + (i * 0.26); // sweeps left to right
        this.playSpatialChiptune({
          frequency: freq,
          type1: 'square',
          type2: 'sawtooth',
          duration: stepDuration,
          volume: 0.24, // Boosted from 0.08
          pan: pan,
          sendToDelay: true
        });
      }, i * stepDuration * 1000);
    });
  }

  /**
   * Sparkle sound for power-up events (high frequency wobble 1000Hz → 1800Hz)
   */
  playPowerUp() {
    this.playSpatialChiptune({
      frequency: 1000,
      frequencyEnd: 1800,
      type1: 'sine',
      type2: 'square',
      duration: 0.2,
      volume: 0.18, // Boosted from 0.07
      pan: -0.2,
      sendToDelay: true
    });
  }

  /**
   * Victory fanfare for high-score events (C5 → E5 → G5 → hold C6 300ms)
   */
  playHighScore() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const stepDuration = 0.1;
    const now = this.ctx.currentTime;

    // Sawtooth arpeggio lead-in
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playSpatialChiptune({
          frequency: freq,
          type1: 'sawtooth',
          type2: 'square',
          duration: stepDuration,
          volume: 0.18, // Boosted from 0.06
          pan: -0.3 + (i * 0.3),
          sendToDelay: true
        });
      }, i * stepDuration * 1000);
    });

    // Sustained C6 hold
    setTimeout(() => {
      this.playSpatialChiptune({
        frequency: 1046.50, // C6
        type1: 'sine',
        type2: 'square',
        duration: 0.35,
        volume: 0.25, // Boosted from 0.09
        pan: 0.0,
        sendToDelay: true
      });
    }, notes.length * stepDuration * 1000);
  }

  /**
   * Quick coin pickup sound (E6 → B6, square wave, bright)
   */
  playCoin() {
    this.playSpatialChiptune({
      frequency: 1318.51,
      frequencyEnd: 1975.53,
      type1: 'square',
      type2: 'sine',
      duration: 0.09,
      volume: 0.18, // Boosted from 0.06
      pan: 0.25,
      sendToDelay: true
    });
  }

  /**
   * Impact sound effect (white noise burst mixed with low 80Hz thump)
   */
  playHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const duration = 0.08; // 80ms
    const now = this.ctx.currentTime;

    // Panned noise burst
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

      noiseGain.gain.setValueAtTime(0.22, now); // Boosted from 0.1
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      let outputNode: AudioNode = noiseGain;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.random() * 0.6 - 0.3, now); // slight pan wiggle
        noiseGain.connect(panner);
        outputNode = panner;
      }

      outputNode.connect(this.ctx.destination);
      if (this.delayNode) {
        noiseGain.connect(this.delayNode);
      }

      noiseSource.start(now);
      noiseSource.stop(now + duration);
    } catch (e) {}

    // Low frequency thump
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);

      gain.gain.setValueAtTime(0.35, now); // Boosted from 0.15
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      let outputNode: AudioNode = gain;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(0.0, now);
        gain.connect(panner);
        outputNode = panner;
      }

      outputNode.connect(this.ctx.destination);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }
}

export const gameAudio = new GameAudio();
export default gameAudio;
