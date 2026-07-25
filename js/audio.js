// Zen Stack 3D - ASMR Musical Scale Audio Synthesizer (Web Audio API)
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        // Pentatonic / Diatonic musical scale frequencies (C4 to C6)
        this.scale = [
            261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25,
            587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50
        ];
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playNote(comboIndex = 0) {
        if (this.muted) return;
        this.init();

        const noteIndex = comboIndex % this.scale.length;
        const freq = this.scale[noteIndex];

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Warm Marimba / Kalimba tone (Sine + subtle Triangle harmonic)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
    }

    playSlice() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    playGameOver() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const freqs = [300, 260, 220, 180];
        freqs.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, now + idx * 0.08);

            gain.gain.setValueAtTime(0.15, now + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.001, now + (idx + 1) * 0.08 + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + (idx + 1) * 0.08 + 0.1);
        });
    }

    playComboBonus() {
        if (this.muted) return;
        this.init();

        const now = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.04);

            gain.gain.setValueAtTime(0.25, now + idx * 0.04);
            gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.2);
        });
    }
}

window.soundEngine = new AudioEngine();
