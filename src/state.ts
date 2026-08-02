import {
  BASE_HEAL_PER_COMBAT, BASE_INTEREST_CAP, BASE_REROLL_COST, BASE_SHOP_SLOTS,
  HEART_BASE_HP, START_GOLD, deployCap,
} from './const';
import { AUGMENTS, augmentsForClass } from './data/augments';
import { CLASSES } from './data/classes';
import { TOWERS } from './data/towers';
import { makeRng } from './rng';
import type {
  AugmentDef, ClassId, Game, Modifiers, RunState, TowerInst,
} from './types';

export function createGame(): Game {
  return {
    screen: 'menu',
    run: null,
    combat: null,
    ui: { selectedBench: null, selectedTower: null, hoverCell: null, hoverTower: null, pendingCell: null },
    speed: 1,
    paused: false,
    events: [],
  };
}

export function baseModifiers(classId: ClassId): Modifiers {
  const cls = CLASSES[classId];
  return {
    dmgMult: 1,
    dmgMultByClass: {},
    flatDmgByClass: {},
    atkSpeedMult: 1,
    atkSpeedByClass: {},
    atkSpeedBelowHalf: 0,
    rangeMult: 1,
    critChance: 0,
    critChanceByClass: {},
    critDamage: 2,
    armorPierce: 0,
    goldPerKill: 0,
    goldPerWave: 0,
    interestCap: BASE_INTEREST_CAP,
    rerollCost: BASE_REROLL_COST,
    shopSlots: BASE_SHOP_SLOTS + cls.extraShopSlots,
    heartMaxBonus: 0,
    healPerCombat: BASE_HEAL_PER_COMBAT + cls.extraHealPerCombat,
    bleedDurationBonus: 0,
    bleedAmpTaken: 0,
    burnMult: 1,
    poisonMult: 1,
    poisonExtraStacks: 0,
    poisonNoDecay: false,
    poisonExplode: false,
    slowBonus: 0,
    slowedAmpTaken: 0,
    eliteAmpTaken: 0,
    splashAmp: 0,
    upgradeDiscount: 0,
    interestDiv: 10,
    dmgPerWaveCleared: 0,
    crossClassShop: false,
    augRerolls: 1,
    flags: new Set<string>(),
  };
}

export function newRun(g: Game, classId: ClassId, ascension = 0, seedOverride?: number): void {
  const seed = seedOverride !== undefined ? (seedOverride >>> 0) : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const run: RunState = {
    classId,
    seed,
    rng: makeRng(seed),
    heartHp: HEART_BASE_HP,
    gold: START_GOLD,
    combatIndex: 1,
    towers: [],
    augments: [],
    mods: baseModifiers(classId),
    shop: [],
    stats: { kills: 0, wavesCleared: 0, goldEarned: 0, dmgDealt: 0 },
    uidCounter: 1,
    deployBonus: 0,
    shopLocked: false,
    ascension: Math.max(0, Math.min(5, ascension)),
    nodeRisky: false,
  };
  for (const defId of CLASSES[classId].startingTowers) addTower(run, defId);
  run.heartHp = heartMax(run);
  g.run = run;
  g.speed = 1;
  g.paused = false;
  g.events = [];
}

export function addTower(run: RunState, defId: string): TowerInst {
  const t: TowerInst = {
    uid: run.uidCounter++,
    defId,
    placed: false,
    cell: null,
    cooldown: 0,
    kills: 0,
    buffMult: 1,
    speedBuff: 1,
    permDmg: 0,
    combatDmg: 0,
    level: 1,
  };
  run.towers.push(t);
  return t;
}

export function heartMax(run: RunState): number {
  return HEART_BASE_HP + run.mods.heartMaxBonus - (run.ascension >= 3 ? 10 : 0);
}

// Malus cumulatifs des niveaux d'Ascension (index 1..5)
export const ASCENSION_DESCS = [
  '',
  'Les ennemis ont +10 % de PV',
  'Or d’éliminations réduit et ennemis 5 % plus rapides',
  'Le Cœur perd 10 PV max et les ennemis gagnent encore +10 % de PV',
  'Les ennemis sont encore 10 % plus rapides',
  'Ennemis +20 % de PV ; élites, mini-boss et boss +25 % de PV',
];

export function interestFor(run: RunState): number {
  return Math.min(Math.floor(run.gold / run.mods.interestDiv), run.mods.interestCap);
}

export const MAX_TOWER_LEVEL = 3;

/** Coût de l'amélioration au niveau suivant (progressif : ×3 puis ×5 du prix de base). */
export function upgradeCost(run: RunState, t: TowerInst): number {
  const base = TOWERS[t.defId].cost * (t.level === 1 ? 3 : 5);
  return Math.max(1, Math.ceil(base * (1 - run.mods.upgradeDiscount)));
}

export const MAX_DEPLOY_BONUS = 4;

export function deployCapFor(run: RunState): number {
  return deployCap(run.combatIndex) + run.deployBonus + CLASSES[run.classId].extraDeploy;
}

export function deploySlotCost(run: RunState): number {
  return 20 + 10 * run.deployBonus;
}

/** Achète +1 emplacement de déploiement (puits d'or à la TFT). */
export function buyDeploySlot(run: RunState): boolean {
  if (run.deployBonus >= MAX_DEPLOY_BONUS) return false;
  const cost = deploySlotCost(run);
  if (run.gold < cost) return false;
  run.gold -= cost;
  run.deployBonus++;
  return true;
}

export function benchTowers(run: RunState): TowerInst[] {
  return run.towers.filter((t) => !t.placed);
}

export function placedTowers(run: RunState): TowerInst[] {
  return run.towers.filter((t) => t.placed);
}

export interface EffStats {
  damage: number;
  cooldown: number;
  range: number;
  critChance: number;
  targets: number;
  splash: number;
  slow: { factor: number; duration: number } | null;
}

/** Stats effectives d'une tour : base + augments + aura d'étendard. */
export function towerEffStats(run: RunState, t: TowerInst): EffStats {
  const def = TOWERS[t.defId];
  const m = run.mods;
  const cls = def.classId;

  const lvl = t.level ?? 1;
  let dmg = def.damage + (m.flatDmgByClass[cls] ?? 0) + (t.permDmg ?? 0);
  let mult = m.dmgMult + (m.dmgMultByClass[cls] ?? 0) + m.dmgPerWaveCleared * run.stats.wavesCleared;
  mult *= t.buffMult;
  mult *= Math.pow(1.3, lvl - 1); // niveaux d'amélioration ⭐
  dmg *= mult;

  let atkSpeed = m.atkSpeedMult + (m.atkSpeedByClass[cls] ?? 0);
  if (run.heartHp < heartMax(run) / 2) atkSpeed += m.atkSpeedBelowHalf;
  atkSpeed *= t.speedBuff ?? 1;
  atkSpeed *= Math.pow(1.05, lvl - 1);
  const cooldown = def.cooldown / Math.max(0.2, atkSpeed);

  let range = def.range * m.rangeMult;
  if (def.id === 'tourbillon' && m.flags.has('tourbillon_cyclone')) range *= 1.4;

  let targets = def.targets ?? 1;
  if (def.id === 'dague' && m.flags.has('dague_extra')) targets += 1;

  const critChance = (def.critChance ?? 0) + m.critChance + (m.critChanceByClass[cls] ?? 0);

  let slow = def.slow ? { factor: Math.min(0.8, def.slow.factor + m.slowBonus), duration: def.slow.duration } : null;
  if (def.id === 'tourbillon' && m.flags.has('tourbillon_cyclone')) {
    slow = { factor: Math.min(0.8, 0.2 + m.slowBonus), duration: 0.8 };
  }

  return { damage: dmg, cooldown, range, critChance, targets, splash: def.splash ?? 0, slow };
}

// ---------- Augments ----------

/** Tire `count` augments distincts à proposer, selon la classe et l'avancement. */
export function pickAugmentOffers(run: RunState, count = 3, afterElite = false, forceRare = false): AugmentDef[] {
  const rareChance = forceRare ? 1 : Math.min(0.8, 0.22 + 0.04 * run.combatIndex + (afterElite ? 0.18 : 0));
  const pool = augmentsForClass(run.classId).filter(
    (a) => a.stackable || !run.augments.includes(a.id),
  );
  const offers: AugmentDef[] = [];
  let guard = 0;
  while (offers.length < count && guard++ < 100) {
    const wantRare = run.rng.chance(rareChance);
    let candidates = pool.filter(
      (a) => a.rarity === (wantRare ? 'rare' : 'common') && !offers.includes(a),
    );
    if (!candidates.length) candidates = pool.filter((a) => !offers.includes(a));
    if (!candidates.length) break;
    offers.push(run.rng.pick(candidates));
  }
  return offers;
}

export function applyAugment(run: RunState, id: string): void {
  const def = AUGMENTS[id];
  if (!def) return;
  run.augments.push(id);
  def.apply(run, run.mods);
  run.heartHp = Math.min(run.heartHp, heartMax(run));
}
