// Procedural sound effects via the Web Audio API (no asset files).
// Driven by the sim's event stream plus UI notifications. Rate-limited per
// sound and capped in total voices so 40 units fighting never clip.

const MIN_GAP = { attack: 0.07, death: 0.05, dropoff: 0.12, select: 0.05, command: 0.05, rejected: 0.3, built: 0.2, trained: 0.15 };
const MAX_VOICES = 14;
const HEARING = 1400; // px from the camera center at which world sounds fade out

export class Sfx {
  constructor({ createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(), storage = globalThis.localStorage } = {}) {
    this.createContext = createContext;
    this.storage = storage;
    this.ctx = null;
    this.voices = 0;
    this.last = {};
    this.played = 0; // total voices started (for tests/diagnostics)
    try { this.muted = storage?.getItem('prism-muted') === '1'; } catch { this.muted = false; }
  }

  // Browsers only allow audio after a user gesture.
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = this.createContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { this.storage?.setItem('prism-muted', this.muted ? '1' : '0'); } catch { /* storage unavailable */ }
    return this.muted;
  }

  // Returns a gain node for a new voice, or null if muted / rate-limited / too many voices.
  voice(kind, volume, duration) {
    if (this.muted || !this.ctx || volume <= 0.01) return null;
    const now = this.ctx.currentTime;
    if (now - (this.last[kind] ?? -1) < (MIN_GAP[kind] ?? 0.05) || this.voices >= MAX_VOICES) return null;
    this.last[kind] = now;
    this.voices++;
    this.played++;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    g.connect(this.master);
    setTimeout(() => { this.voices--; g.disconnect?.(); }, duration * 1000 + 50);
    return g;
  }

  tone(kind, { freq, to = freq, type = 'sine', dur = 0.1, vol = 0.5, delay = 0 }) {
    const g = this.voice(kind, vol, dur + delay);
    if (!g) return;
    const o = this.ctx.createOscillator(), t = this.ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur);
  }

  noise(kind, { dur = 0.1, vol = 0.4, filter = 'highpass', freq = 1500 }) {
    const g = this.voice(kind, vol, dur);
    if (!g) return;
    const ctx = this.ctx, len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1; // audio texture only, not sim state
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    src.buffer = buf;
    src.connect(f);
    f.connect(g);
    src.start();
  }

  // UI sounds (not positional).
  ui(name) {
    if (name === 'select') this.tone('select', { freq: 880, to: 990, dur: 0.05, vol: 0.25 });
    else if (name === 'command') { this.tone('command', { freq: 520, to: 700, type: 'triangle', dur: 0.07, vol: 0.3 }); }
    else if (name === 'rejected') this.tone('rejected', { freq: 150, to: 110, type: 'square', dur: 0.18, vol: 0.25 });
  }

  // World events, attenuated by distance from the camera center (cx, cy).
  handle(events, cx = 0, cy = 0) {
    for (const e of events) {
      const d = e.x !== undefined ? Math.hypot(e.x - cx, e.y - cy) : 0;
      const near = Math.max(0, 1 - d / HEARING);
      switch (e.type) {
        case 'attack':
          if (e.attack === 'blade') this.noise('attack', { dur: 0.05, vol: 0.25 * near, freq: 3000 });
          else if (e.attack === 'bolt') this.tone('attack', { freq: 1400, to: 380, type: 'sawtooth', dur: 0.08, vol: 0.12 * near });
          else if (e.attack === 'crush') this.noise('attack', { dur: 0.12, vol: 0.45 * near, filter: 'lowpass', freq: 400 });
          else if (e.attack === 'lance') this.tone('attack', { freq: 180, to: 1600, type: 'sawtooth', dur: 0.16, vol: 0.14 * near });
          break;
        case 'death':
          this.noise('death', { dur: e.kind === 'building' ? 0.6 : 0.3, vol: (e.kind === 'building' ? 0.7 : 0.4) * near, filter: 'lowpass', freq: 700 });
          this.tone('death', { freq: 320, to: 50, dur: 0.3, vol: 0.2 * near });
          break;
        case 'built':
          [523, 659, 784].forEach((f, i) => this.tone(`built${i}`, { freq: f, dur: 0.12, vol: 0.3, delay: i * 0.09 }));
          break;
        case 'trained':
          this.tone('trained', { freq: 660, to: 880, type: 'triangle', dur: 0.1, vol: 0.28 });
          break;
        case 'dropoff':
          this.tone('dropoff', { freq: 1250, to: 1500, dur: 0.06, vol: 0.08 * near });
          break;
        case 'rejected':
          if (e.team === 1) this.ui('rejected');
          break;
        default:
      }
    }
  }
}
