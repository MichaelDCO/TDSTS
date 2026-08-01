// Séquenceur chiptune 8 bits — 3 pistes (menu, combat, boss), zéro asset.
// Ordonnanceur à anticipation (lookahead) sur l'horloge WebAudio : timing stable.
import { audioBus } from './audio';

export type TrackName = 'menu' | 'combat' | 'boss';

// note MIDI → fréquence
const F = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface TrackDef {
  bpm: number;
  bass: (number | null)[]; // triangle (32 pas, croches)
  lead: (number | null)[]; // square
  kick: number[]; // pas (mod 32) avec grosse caisse
  hatEvery: number; // charley tous les N pas
  leadShift?: number; // transposition du lead (demi-tons)
}

// La mineur, ambiance sombre de la Flèche
const COMBAT: TrackDef = {
  bpm: 112,
  bass: [
    45, null, 45, null, 52, null, 45, null, 48, null, 48, null, 43, null, 48, null,
    45, null, 45, null, 52, null, 45, null, 50, null, 50, null, 52, null, 52, null,
  ],
  lead: [
    69, null, null, 72, null, 76, null, 74, 72, null, 69, null, 67, null, 69, null,
    69, null, null, 72, null, 76, null, 79, 77, null, 76, null, 74, null, 72, null,
  ],
  kick: [0, 8, 16, 24],
  hatEvery: 2,
};

const MENU: TrackDef = {
  bpm: 84,
  bass: [
    45, null, null, null, null, null, null, null, 41, null, null, null, null, null, null, null,
    48, null, null, null, null, null, null, null, 43, null, null, null, null, null, null, null,
  ],
  lead: [
    69, 72, 76, 72, 69, 72, 76, 72, 65, 69, 72, 69, 65, 69, 72, 69,
    72, 76, 79, 76, 72, 76, 79, 76, 67, 71, 74, 71, 67, 71, 74, 71,
  ],
  kick: [],
  hatEvery: 8,
};

const BOSS: TrackDef = { ...COMBAT, bpm: 128, leadShift: 12 };

const TRACKS: Record<TrackName, TrackDef> = { menu: MENU, combat: COMBAT, boss: BOSS };

let current: TrackName | null = null;
let step = 0;
let nextTime = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let musicGain: GainNode | null = null;

function bus(): { ctx: AudioContext; out: GainNode } | null {
  const b = audioBus();
  if (!b) return null;
  if (!musicGain) {
    musicGain = b.ctx.createGain();
    musicGain.gain.value = 0.4; // relatif au master (0.22) → ~0.09 absolu
    musicGain.connect(b.master);
  }
  return { ctx: b.ctx, out: musicGain };
}

function noteAt(ctx: AudioContext, out: GainNode, t: number, freq: number, dur: number, type: OscillatorType, vol: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function kickAt(ctx: AudioContext, out: GainNode, t: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.12);
}

function hatAt(ctx: AudioContext, out: GainNode, t: number): void {
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
}

function schedule(): void {
  const b = bus();
  if (!b || !current) return;
  // contexte suspendu (avant le premier geste utilisateur) : on attend sans accumuler de notes
  if (b.ctx.state === 'suspended') {
    nextTime = b.ctx.currentTime + 0.06;
    return;
  }
  const def = TRACKS[current];
  const stepDur = 60 / def.bpm / 2; // croches
  while (nextTime < b.ctx.currentTime + 0.16) {
    const i = step % def.bass.length;
    const bn = def.bass[i];
    if (bn != null) noteAt(b.ctx, b.out, nextTime, F(bn), stepDur * 0.92, 'triangle', 0.5);
    const ln = def.lead[i];
    if (ln != null) noteAt(b.ctx, b.out, nextTime, F(ln + (def.leadShift ?? 0)), stepDur * 0.55, 'square', 0.15);
    if (def.kick.includes(i % 32)) kickAt(b.ctx, b.out, nextTime);
    if (i % def.hatEvery === 0) hatAt(b.ctx, b.out, nextTime + stepDur / 2);
    nextTime += stepDur;
    step++;
  }
}

/** Lance (ou bascule vers) une piste. Sans effet si déjà en cours. */
export function playMusic(name: TrackName): void {
  if (current === name && timer) return;
  const b = bus();
  if (!b) return;
  current = name;
  step = 0;
  nextTime = b.ctx.currentTime + 0.06;
  if (!timer) timer = setInterval(schedule, 45);
}

export function stopMusic(): void {
  current = null;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function currentTrack(): TrackName | null {
  return current;
}
