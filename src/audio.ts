// Moteur audio procédural (WebAudio) — aucun asset, tout est synthétisé.
// Volumes bas volontairement ; throttling sur les sons fréquents ; muet pendant les runs du bot.

export type SfxName =
  | 'shoot' | 'pulse' | 'death' | 'heartHit' | 'waveStart' | 'waveClear'
  | 'buy' | 'sell' | 'place' | 'reroll' | 'augment' | 'victory' | 'defeat' | 'lock';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('rtd-muted') === '1';
} catch { /* stockage indisponible */ }

const lastPlayed: Partial<Record<SfxName, number>> = {};
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  shoot: 50, pulse: 90, death: 70, place: 30,
};

function ensureCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq0: number, freq1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export function playSfx(name: SfxName): void {
  if (muted) return;
  if ((window as unknown as Record<string, unknown>).__botRunning) return;
  const now = performance.now();
  const throttle = THROTTLE_MS[name];
  if (throttle && lastPlayed[name] && now - lastPlayed[name]! < throttle) return;
  lastPlayed[name] = now;
  if (!ensureCtx()) return;
  try {
    switch (name) {
      case 'shoot': tone(760, 500, 0.055, 'square', 0.09); break;
      case 'pulse': tone(230, 150, 0.09, 'sawtooth', 0.08); break;
      case 'death': tone(430, 130, 0.13, 'triangle', 0.16); break;
      case 'heartHit':
        tone(170, 65, 0.35, 'sine', 0.5);
        noise(0.22, 0.28);
        break;
      case 'waveStart': tone(290, 640, 0.16, 'triangle', 0.2); break;
      case 'waveClear':
        tone(523, 523, 0.09, 'triangle', 0.18);
        tone(659, 659, 0.09, 'triangle', 0.18, 0.09);
        tone(784, 784, 0.12, 'triangle', 0.2, 0.18);
        break;
      case 'buy': tone(920, 1280, 0.08, 'triangle', 0.18); break;
      case 'sell': tone(720, 370, 0.1, 'triangle', 0.16); break;
      case 'place': tone(190, 115, 0.08, 'square', 0.16); break;
      case 'reroll': tone(490, 810, 0.06, 'square', 0.12); break;
      case 'lock': tone(600, 600, 0.05, 'square', 0.12); break;
      case 'augment':
        tone(660, 990, 0.22, 'sine', 0.2);
        tone(830, 1240, 0.22, 'sine', 0.14, 0.1);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.22, i * 0.13));
        break;
      case 'defeat': tone(210, 85, 0.8, 'sawtooth', 0.25); break;
    }
  } catch { /* l'audio ne doit jamais casser le jeu */ }
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem('rtd-muted', muted ? '1' : '0');
  } catch { /* stockage indisponible */ }
  if (!muted) playSfx('lock');
  return muted;
}

export function isMuted(): boolean {
  return muted;
}
