// Moteur audio procédural (WebAudio) — aucun asset, tout est synthétisé.
// Volumes bas volontairement ; throttling sur les sons fréquents ; muet pendant les runs du bot.

export type SfxName =
  | 'shoot' | 'pulse' | 'death' | 'heartHit' | 'waveStart' | 'waveClear'
  | 'buy' | 'sell' | 'place' | 'reroll' | 'augment' | 'victory' | 'defeat' | 'lock' | 'zap';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('rtd-muted') === '1';
} catch { /* stockage indisponible */ }

const lastPlayed: Partial<Record<SfxName, number>> = {};
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  shoot: 50, pulse: 90, death: 70, place: 30, zap: 65,
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

/** Bus audio partagé (utilisé par le séquenceur musical). */
export function audioBus(): { ctx: AudioContext; master: GainNode } | null {
  if (!ensureCtx() || !ctx || !master) return null;
  return { ctx, master };
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
      case 'zap': tone(1250, 320, 0.07, 'sawtooth', 0.08); break;
      case 'pulse': tone(230, 150, 0.09, 'sawtooth', 0.08); break;
      case 'death': tone(392, 110, 0.12, 'square', 0.12); break;
      case 'heartHit':
        tone(170, 65, 0.35, 'sine', 0.5);
        noise(0.22, 0.28);
        break;
      case 'waveStart':
        tone(262, 262, 0.07, 'square', 0.16);
        tone(392, 392, 0.07, 'square', 0.16, 0.07);
        tone(523, 523, 0.1, 'square', 0.18, 0.14);
        break;
      case 'waveClear':
        tone(523, 523, 0.08, 'square', 0.15);
        tone(659, 659, 0.08, 'square', 0.15, 0.08);
        tone(784, 784, 0.12, 'square', 0.17, 0.16);
        break;
      case 'buy':
        // le « bling » de pièce à l'ancienne
        tone(988, 988, 0.05, 'square', 0.14);
        tone(1319, 1319, 0.12, 'square', 0.14, 0.05);
        break;
      case 'sell': tone(720, 370, 0.1, 'triangle', 0.16); break;
      case 'place': tone(190, 115, 0.08, 'square', 0.16); break;
      case 'reroll': tone(490, 810, 0.06, 'square', 0.12); break;
      case 'lock': tone(600, 600, 0.05, 'square', 0.12); break;
      case 'augment':
        [660, 880, 1100].forEach((f, i) => tone(f, f, 0.11, 'square', 0.13, i * 0.08));
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.17, i * 0.12));
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
