// Procedural Audio Synthesizer using native HTML5 Web Audio API
// Self-contained, zero-dependency, works entirely in-browser.

class AudioSynthEngine {
  constructor() {
    this.ctx = null;
    this.lobbyTimer = null;
    this.lobbyIsPlaying = false;
    this.tempo = 120; // BPM
    this.beatLength = 60 / this.tempo;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Standard click / toggle sound
  playClick() {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio Context Error:", e);
    }
  }

  // Ticking beep for question countdown
  playTimerBeep() {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn(e);
    }
  }

  // Correct answer happy arpeggio (Major chord)
  playCorrect() {
    try {
      this.init();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      const now = this.ctx.currentTime;
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.08 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  // Incorrect answer descending buzz
  playIncorrect() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      
      // Discordant dual oscillators for dirty buzz
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.linearRampToValueAtTime(70, now + 0.45);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(122, now); // Detuned slightly
      osc2.frequency.linearRampToValueAtTime(71, now + 0.45);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn(e);
    }
  }

  // Start the procedurally generated background loop (Kahoot-like bouncy bass)
  startLobbyMusic() {
    try {
      this.init();
      if (this.lobbyIsPlaying) return;
      this.lobbyIsPlaying = true;
      
      let step = 0;
      // Synthesized retro loop
      const playStep = () => {
        if (!this.lobbyIsPlaying) return;
        
        const now = this.ctx.currentTime;
        
        // Kahoot lobby style: steady bouncing 8th note bassline
        // Progression: Am (4 steps) -> C (4 steps) -> G (4 steps) -> F (4 steps)
        const bassProgression = [
          // Am
          110.00, 110.00, 220.00, 110.00,
          // C
          130.81, 130.81, 261.63, 130.81,
          // G
          98.00, 98.00, 196.00, 98.00,
          // F
          87.31, 87.31, 174.61, 87.31
        ];
        
        const melodyProgression = [
          // Am
          440.00, 0, 493.88, 523.25,
          // C
          523.25, 0, 587.33, 392.00,
          // G
          392.00, 0, 440.00, 493.88,
          // F
          349.23, 0, 392.00, 261.63
        ];
        
        const beatIndex = step % 16;
        
        // Play Bass Note
        const bassFreq = bassProgression[beatIndex];
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + this.beatLength * 0.9);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + this.beatLength);
        
        // Play Melody Note (occasionally)
        const melFreq = melodyProgression[beatIndex];
        if (melFreq > 0 && Math.random() > 0.3) {
          const melOsc = this.ctx.createOscillator();
          const melGain = this.ctx.createGain();
          melOsc.type = 'sine';
          melOsc.frequency.setValueAtTime(melFreq, now);
          
          melGain.gain.setValueAtTime(0, now);
          melGain.gain.linearRampToValueAtTime(0.03, now + 0.02);
          melGain.gain.exponentialRampToValueAtTime(0.001, now + this.beatLength * 1.5);
          
          melOsc.connect(melGain);
          melGain.connect(this.ctx.destination);
          melOsc.start(now);
          melOsc.stop(now + this.beatLength * 2);
        }
        
        // Add a subtle hi-hat / tick for rhythm
        if (beatIndex % 2 === 0) {
          const hatOsc = this.ctx.createOscillator();
          const hatGain = this.ctx.createGain();
          hatOsc.type = 'sine';
          // random high frequency noise
          hatOsc.frequency.setValueAtTime(10000, now);
          hatGain.gain.setValueAtTime(0.008, now);
          hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
          hatOsc.connect(hatGain);
          hatGain.connect(this.ctx.destination);
          hatOsc.start(now);
          hatOsc.stop(now + 0.05);
        }
        
        step++;
        this.lobbyTimer = setTimeout(playStep, this.beatLength * 1000);
      };
      
      playStep();
    } catch (e) {
      console.warn("Lobby music failed to start:", e);
    }
  }

  stopLobbyMusic() {
    this.lobbyIsPlaying = false;
    if (this.lobbyTimer) {
      clearTimeout(this.lobbyTimer);
      this.lobbyTimer = null;
    }
  }

  // Grand podium victory fanfare
  playPodium() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      // Ascending grand brass-like progression
      const chords = [
        [196.00, 246.94, 293.66], // G3, B3, D4 (G Major)
        [220.00, 261.63, 329.63], // A3, C4, E4 (A minor)
        [261.63, 329.63, 392.00], // C4, E4, G4 (C Major)
        [392.00, 493.88, 587.33, 783.99] // G4, B4, D5, G5 (Grand G Major high)
      ];
      
      chords.forEach((chord, idx) => {
        const chordTime = now + idx * 0.4;
        const duration = idx === 3 ? 1.5 : 0.35;
        
        chord.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, chordTime);
          
          // lowpass filter to make it sound brassy instead of piercing
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(freq * 3, chordTime);
          
          gain.gain.setValueAtTime(0, chordTime);
          gain.gain.linearRampToValueAtTime(0.04, chordTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + duration);
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.start(chordTime);
          osc.stop(chordTime + duration + 0.1);
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }
}

export const audioSynth = new AudioSynthEngine();
