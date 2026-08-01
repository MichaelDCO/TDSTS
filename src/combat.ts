import { playSfx } from './audio';
import { CELL, keyOf, combatHpMult, killGoldCap, waveHpMult } from './const';
import { COMBAT_PLAN, generateWaves } from './data/combats';
import { ENEMIES } from './data/enemies';
import { MAPS } from './data/maps';
import { TOWERS } from './data/towers';
import { rollShop } from './shop';
import { heartMax, interestFor, placedTowers, towerEffStats } from './state';
import type {
  CombatState, EnemyInst, Floater, Game, HitEffects, Modifiers, Particle, PathGeom,
  Projectile, TowerInst, Vec,
} from './types';

// ---------- Géométrie ----------

function cellCenter(c: Vec): Vec {
  return { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL };
}

function buildPath(waypoints: Vec[]): PathGeom {
  const pts = waypoints.map(cellCenter);
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(total);
  }
  return { pts, cum, total };
}

function pointAt(path: PathGeom, dist: number): Vec {
  const d = Math.max(0, Math.min(dist, path.total));
  for (let i = 1; i < path.pts.length; i++) {
    if (d <= path.cum[i]) {
      const segLen = path.cum[i] - path.cum[i - 1] || 1;
      const t = (d - path.cum[i - 1]) / segLen;
      return {
        x: path.pts[i - 1].x + (path.pts[i].x - path.pts[i - 1].x) * t,
        y: path.pts[i - 1].y + (path.pts[i].y - path.pts[i - 1].y) * t,
      };
    }
  }
  return { ...path.pts[path.pts.length - 1] };
}

function rasterizeCells(waypoints: Vec[], into: Set<string>): void {
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let { x, y } = a;
    into.add(keyOf(x, y));
    while (x !== b.x || y !== b.y) {
      x += dx;
      y += dy;
      into.add(keyOf(x, y));
    }
  }
}

export function towerCenter(t: TowerInst): Vec {
  return cellCenter(t.cell!);
}

export function heartPos(c: CombatState): Vec {
  return cellCenter(c.map.heart);
}

// ---------- Mise en place d'un combat ----------

export function setupCombat(g: Game): void {
  const run = g.run!;
  const def = COMBAT_PLAN[run.combatIndex - 1];
  const map = MAPS[def.mapId];
  const paths: Record<string, PathGeom> = {};
  const blocked = new Set<string>();
  for (const p of map.portals) {
    // seuls les portails du combat comptent, mais on bloque tous les chemins visibles
    paths[p.id] = buildPath(p.waypoints);
    rasterizeCells(p.waypoints, blocked);
  }
  blocked.add(keyOf(map.heart.x, map.heart.y));

  const combat: CombatState = {
    def,
    map,
    paths,
    blocked,
    waveIndex: 0,
    phase: 'prep',
    waveTime: 0,
    spawnQueue: [],
    waves: generateWaves(def, run.rng),
    enemies: [],
    projectiles: [],
    particles: [],
    floaters: [],
    activePortals: new Set(),
    hpMult: combatHpMult(def.index),
    time: 0,
    waveKillGold: 0,
    shake: 0,
  };
  g.combat = combat;
  refreshActivePortals(combat);

  // toutes les tours reviennent en réserve : nouvelle carte, nouveau déploiement
  for (const t of run.towers) {
    t.placed = false;
    t.cell = null;
    t.cooldown = 0;
    t.buffMult = 1;
    t.speedBuff = 1;
    t.combatDmg = 0;
  }
  g.ui.selectedBench = null;
  g.ui.selectedTower = null;
  rollShop(g);
}

function refreshActivePortals(c: CombatState): void {
  const nextWaveNum = c.waveIndex + 1;
  c.activePortals.clear();
  for (const pid of c.def.portalIds) {
    if ((c.def.portalActivation[pid] ?? 1) <= nextWaveNum) c.activePortals.add(pid);
  }
}

/** Portails qui s'activeront à la vague suivante (télégraphe). */
export function upcomingPortals(c: CombatState): string[] {
  const nextNext = c.waveIndex + 2;
  return c.def.portalIds.filter((pid) => (c.def.portalActivation[pid] ?? 1) === nextNext);
}

export function startWave(g: Game): void {
  const c = g.combat;
  if (!c || c.phase !== 'prep') return;
  c.phase = 'wave';
  c.waveTime = 0;
  c.waveKillGold = 0;
  c.spawnQueue = [...c.waves[c.waveIndex].spawns];
  playSfx('waveStart');
}

// ---------- Ennemis ----------

let enemyUid = 1;

function spawnEnemy(g: Game, enemyId: string, portalId: string, startDist = 0): EnemyInst {
  const c = g.combat!;
  const def = ENEMIES[enemyId];
  const run = g.run!;
  const wMult = waveHpMult(c.waveIndex + 1);
  let ascMult = 1;
  if (run.ascension >= 1) ascMult += 0.1;
  if (run.ascension >= 5) ascMult += 0.3;
  if (run.nodeRisky) ascMult += 0.4; // nœud risqué : ennemis nettement plus coriaces
  const hp = Math.round(def.hp * c.hpMult * wMult * ascMult);
  const e: EnemyInst = {
    uid: enemyUid++,
    defId: enemyId,
    def,
    hp,
    maxHp: hp,
    portalId,
    dist: startDist,
    pos: pointAt(c.paths[portalId], startDist),
    slows: [],
    poisonStacks: 0,
    bleed: null,
    burn: null,
    mark: null,
    accelMult: 1,
    accelTimer: 0,
    enraged: false,
    alive: true,
    bounty: def.bounty + Math.floor((run.combatIndex - 1) / 3),
    heartDmg: def.heartDmg,
    dotTick: 0,
    incoming: 0,
  };
  c.enemies.push(e);
  return e;
}

interface DmgOpts {
  ignoreArmor?: boolean;
  pierce?: number;
  isDot?: boolean;
  crit?: boolean;
  quiet?: boolean;
}

export function damageEnemy(g: Game, e: EnemyInst, raw: number, opts: DmgOpts = {}): number {
  if (!e.alive) return 0;
  const m = g.run!.mods;
  let dmg = raw;
  if (!opts.isDot && !opts.ignoreArmor) {
    dmg = Math.max(1, dmg - Math.max(0, e.def.armor - (opts.pierce ?? 0)));
  }
  if (e.mark) dmg *= 1 + e.mark.amp;
  if (e.bleed && m.bleedAmpTaken > 0) dmg *= 1 + m.bleedAmpTaken;
  if (e.slows.length > 0 && m.slowedAmpTaken > 0) dmg *= 1 + m.slowedAmpTaken;
  if (e.def.kind !== 'normal' && m.eliteAmpTaken > 0) dmg *= 1 + m.eliteAmpTaken;
  e.hp -= dmg;
  g.run!.stats.dmgDealt += dmg;
  if (!opts.quiet && !opts.isDot) {
    addFloater(g.combat!, e.pos.x, e.pos.y - e.def.radius - 4, Math.round(dmg).toString(),
      opts.crit ? '#ffd75e' : '#f0f0f0', opts.crit ? 1.35 : 1);
  }
  return dmg;
}

function applyHitEffects(g: Game, e: EnemyInst, fx: HitEffects): void {
  if (!e.alive) return;
  if (fx.bleed) {
    if (e.bleed) {
      e.bleed.dps = Math.min(e.bleed.dps + fx.bleed.dps * 0.6, fx.bleed.dps * 4);
      e.bleed.t = Math.max(e.bleed.t, fx.bleed.duration);
    } else {
      e.bleed = { dps: fx.bleed.dps, t: fx.bleed.duration };
    }
  }
  if (fx.burn) {
    if (e.burn) {
      e.burn.dps = Math.max(e.burn.dps, fx.burn.dps);
      e.burn.t = Math.max(e.burn.t, fx.burn.duration);
    } else {
      e.burn = { dps: fx.burn.dps, t: fx.burn.duration };
    }
  }
  if (fx.poison) e.poisonStacks += fx.poison;
  if (fx.slow && !e.def.slowImmune) {
    if (e.slows.length < 6) e.slows.push({ f: fx.slow.factor, t: fx.slow.duration });
    else {
      // remplace le plus faible
      let idx = 0;
      for (let i = 1; i < e.slows.length; i++) if (e.slows[i].f < e.slows[idx].f) idx = i;
      e.slows[idx] = { f: fx.slow.factor, t: fx.slow.duration };
    }
  }
}

function killEnemy(g: Game, e: EnemyInst, creditUid?: number): void {
  const c = g.combat!;
  const run = g.run!;
  e.alive = false;
  run.stats.kills++;
  let creditTower: TowerInst | undefined;
  if (creditUid != null) {
    creditTower = run.towers.find((x) => x.uid === creditUid);
    if (creditTower) creditTower.kills++;
  }

  // or : prime + augments + idoles à portée — plafonné par vague (anti-inflation)
  let gold = e.bounty + run.mods.goldPerKill;
  // Marche du Vide : les éliminations en posture Colère rapportent +1 or
  if (creditTower && run.mods.flags.has('wrath_gold') && stanceOf(c, creditTower, run.mods) === 'wrath') {
    gold += 1;
  }
  let idoleBonus = 0;
  for (const t of placedTowers(run)) {
    const def = TOWERS[t.defId];
    if (!def.goldAura || !t.cell) continue;
    const tc = towerCenter(t);
    const range = def.range * run.mods.rangeMult;
    if (Math.hypot(e.pos.x - tc.x, e.pos.y - tc.y) <= range) idoleBonus += def.goldAura;
  }
  gold += Math.min(3, idoleBonus);
  const cap = killGoldCap(run.combatIndex) - (run.ascension >= 2 ? 3 : 0);
  gold = Math.max(0, Math.min(gold, cap - c.waveKillGold));
  c.waveKillGold += gold;
  if (gold > 0) {
    run.gold += gold;
    run.stats.goldEarned += gold;
    addFloater(c, e.pos.x, e.pos.y - 14, `+${gold}`, '#ffd75e', 0.9);
  }
  playSfx('death');

  // éclaboussure de mort
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 70;
    c.particles.push({
      x: e.pos.x, y: e.pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0, life: 0.4 + Math.random() * 0.25, color: e.def.color, size: 2 + Math.random() * 3,
    });
  }

  // Toxines Volatiles : le poison se répand
  if (run.mods.poisonExplode && e.poisonStacks > 0.5) {
    const spread = Math.max(1, e.poisonStacks * 0.8);
    for (const other of c.enemies) {
      if (!other.alive || other === e) continue;
      if (Math.hypot(other.pos.x - e.pos.x, other.pos.y - e.pos.y) <= 75) {
        other.poisonStacks += spread;
      }
    }
    c.particles.push({
      x: e.pos.x, y: e.pos.y, vx: 0, vy: 0, t: 0, life: 0.45,
      color: '#7de08a', size: 4, ring: true, maxR: 75,
    });
  }

  // scission (slimes, boss)
  if (e.def.splitInto) {
    for (let k = 0; k < e.def.splitInto.count; k++) {
      const child = spawnEnemy(g, e.def.splitInto.id, e.portalId,
        Math.max(0, e.dist - 8 - k * 14));
      // les rejetons ne rapportent pas d'or (la prime a déjà été payée sur le parent)
      child.bounty = 0;
    }
  }
}

function enemyReachesHeart(g: Game, e: EnemyInst): void {
  const c = g.combat!;
  const run = g.run!;
  e.alive = false;
  run.heartHp -= e.heartDmg;
  c.shake = Math.min(0.45, 0.25 + e.heartDmg * 0.02);
  playSfx('heartHit');
  const hp = heartPos(c);
  addFloater(c, hp.x, hp.y - 30, `-${e.heartDmg}`, '#ff6b5e', 1.5);
  c.particles.push({
    x: hp.x, y: hp.y, vx: 0, vy: 0, t: 0, life: 0.5,
    color: '#ff6b5e', size: 5, ring: true, maxR: 55,
  });
  if (run.heartHp <= 0) {
    run.heartHp = 0;
    c.phase = 'over';
    g.events.push({ type: 'runLost' });
  }
}

function maxSlow(e: EnemyInst): number {
  let s = 0;
  for (const sl of e.slows) s = Math.max(s, sl.f);
  return Math.min(0.8, s);
}

function updateEnemies(g: Game, dt: number): void {
  const c = g.combat!;
  const m = g.run!.mods;
  const ascSpeed = g.run!.ascension >= 4 ? 1.15 : 1;
  for (const e of c.enemies) {
    if (!e.alive) continue;

    // minuteries d'effets
    for (let i = e.slows.length - 1; i >= 0; i--) {
      e.slows[i].t -= dt;
      if (e.slows[i].t <= 0) e.slows.splice(i, 1);
    }
    if (e.mark) {
      e.mark.t -= dt;
      if (e.mark.t <= 0) e.mark = null;
    }

    // dégâts sur la durée (ignorent l'armure)
    let dot = 0;
    if (e.poisonStacks > 0) {
      dot += e.poisonStacks * 1 * m.poisonMult;
      if (!m.poisonNoDecay) e.poisonStacks = Math.max(0, e.poisonStacks - 0.3 * dt);
    }
    if (e.bleed) {
      dot += e.bleed.dps;
      e.bleed.t -= dt;
      if (e.bleed.t <= 0) e.bleed = null;
    }
    if (e.burn) {
      dot += e.burn.dps;
      e.burn.t -= dt;
      if (e.burn.t <= 0) e.burn = null;
    }
    if (dot > 0) damageEnemy(g, e, dot * dt, { isDot: true, quiet: true });

    if (e.hp <= 0) {
      killEnemy(g, e);
      continue;
    }

    // comportements spéciaux
    if (e.def.accelerate) {
      e.accelTimer += dt;
      while (e.accelTimer >= e.def.accelerate.every && e.accelMult < e.def.accelerate.cap) {
        e.accelTimer -= e.def.accelerate.every;
        e.accelMult = Math.min(e.def.accelerate.cap, e.accelMult * e.def.accelerate.mult);
      }
    }
    if (e.def.enrage && !e.enraged && e.hp <= e.maxHp * e.def.enrage.hpPct) {
      e.enraged = true;
      addFloater(c, e.pos.x, e.pos.y - 20, 'ENRAGÉ !', '#ff6b5e', 1.2);
    }

    // déplacement
    const speed = e.def.speed * ascSpeed * e.accelMult * (e.enraged ? e.def.enrage!.speedMult : 1) * (1 - maxSlow(e));
    e.dist += speed * dt;
    const path = c.paths[e.portalId];
    if (e.dist >= path.total) {
      enemyReachesHeart(g, e);
      if (c.phase === 'over') return;
      continue;
    }
    e.pos = pointAt(path, e.dist);
  }
  // purge
  c.enemies = c.enemies.filter((e) => e.alive);
}

// ---------- Tours ----------

/** Posture actuelle d'une tour Watcher (cycle Calme → Colère, désynchronisé par uid). */
export function stanceOf(c: CombatState, t: TowerInst, m: Modifiers): 'calm' | 'wrath' | null {
  if (!TOWERS[t.defId].stance) return null;
  const wrathDur = 1.8 + (m.flags.has('wrath_long') ? 1 : 0);
  const cycle = 3.5 + wrathDur;
  const phase = (c.time + t.uid * 0.9) % cycle;
  return phase < 3.5 ? 'calm' : 'wrath';
}

function stanceDmgMult(st: 'calm' | 'wrath' | null, m: Modifiers): number {
  if (st === 'calm') return m.flags.has('calm_strong') ? 0.85 : 0.7;
  if (st === 'wrath') return 2.1;
  return 1;
}

function recomputeAuras(g: Game): void {
  const run = g.run!;
  const towers = placedTowers(run);
  const banners = towers.filter((t) => TOWERS[t.defId].auraBuffDmg);
  const speeders = towers.filter((t) => TOWERS[t.defId].auraBuffSpeed);
  for (const t of towers) {
    const def = TOWERS[t.defId];
    if (def.kind === 'aura') {
      t.buffMult = 1;
      t.speedBuff = 1;
      continue;
    }
    let buff = 0;
    let spd = 0;
    const tc = towerCenter(t);
    for (const b of banners) {
      const bDef = TOWERS[b.defId];
      const bc = towerCenter(b);
      const range = bDef.range * run.mods.rangeMult;
      if (Math.hypot(tc.x - bc.x, tc.y - bc.y) <= range) buff += bDef.auraBuffDmg!;
    }
    for (const b of speeders) {
      const bDef = TOWERS[b.defId];
      const bc = towerCenter(b);
      const range = bDef.range * run.mods.rangeMult;
      if (Math.hypot(tc.x - bc.x, tc.y - bc.y) <= range) spd += bDef.auraBuffSpeed!;
    }
    t.buffMult = 1 + Math.min(0.5, buff);
    t.speedBuff = 1 + Math.min(0.3, spd);
  }
}

function pickTargets(c: CombatState, center: Vec, range: number, count: number, skipDoomed = false): EnemyInst[] {
  const inRange: { e: EnemyInst; remaining: number }[] = [];
  for (const e of c.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.pos.x - center.x, e.pos.y - center.y) <= range + e.def.radius) {
      inRange.push({ e, remaining: c.paths[e.portalId].total - e.dist });
    }
  }
  inRange.sort((a, b) => a.remaining - b.remaining);
  if (skipDoomed) {
    // anti-overkill : ignore les ennemis dont la mort est déjà « en vol »
    const viable = inRange.filter((x) => x.e.hp > x.e.incoming * 0.9);
    if (viable.length) return viable.slice(0, count).map((x) => x.e);
  }
  return inRange.slice(0, count).map((x) => x.e);
}

function snapshotEffects(g: Game, defId: string): HitEffects {
  const run = g.run!;
  const def = TOWERS[defId];
  const m = run.mods;
  const fx: HitEffects = {
    armorPierce: m.armorPierce + (def.armorPierce ?? 0),
    ignoreArmor: def.ignoreArmor,
  };
  if (def.bleed) fx.bleed = { dps: def.bleed.dps, duration: def.bleed.duration + m.bleedDurationBonus };
  if (def.burn) fx.burn = { dps: def.burn.dps * m.burnMult, duration: def.burn.duration };
  if (def.poison) fx.poison = def.poison + m.poisonExtraStacks;
  if (def.slow) fx.slow = { factor: Math.min(0.8, def.slow.factor + m.slowBonus), duration: def.slow.duration };
  return fx;
}

function fireProjectile(g: Game, t: TowerInst, target: EnemyInst, dmg: number, crit: boolean): void {
  const c = g.combat!;
  const def = TOWERS[t.defId];
  const tc = towerCenter(t);
  const m = g.run!.mods;
  let chain: { jumps: number; range: number; decay: number } | undefined;
  if (def.chain) {
    chain = {
      jumps: def.chain.jumps + (m.flags.has('chain_extra') ? 1 : 0),
      range: def.chain.range,
      decay: m.flags.has('chain_full') ? 1 : def.chain.decay,
    };
  }
  c.projectiles.push({
    x: tc.x,
    y: tc.y - 10,
    speed: def.projectileSpeed ?? 420,
    targetUid: target.uid,
    lastPos: { ...target.pos },
    damage: dmg,
    crit,
    splash: def.splash ?? 0,
    effects: snapshotEffects(g, t.defId),
    color: def.classId === 'ironclad' ? '#ff9d6b' : def.classId === 'silent' ? '#8de08a'
      : def.classId === 'defect' ? '#9be3ff' : '#8fd8ff',
    size: def.splash ? 5 : 3,
    chain,
    hitUids: chain ? [] : undefined,
    sourceUid: t.uid,
  });
  target.incoming += dmg;
}

function updateTowers(g: Game, dt: number): void {
  const run = g.run!;
  const c = g.combat!;
  recomputeAuras(g);
  for (const t of placedTowers(run)) {
    const def = TOWERS[t.defId];
    if (def.kind === 'aura') continue;
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const stats = towerEffStats(run, t);
    const tc = towerCenter(t);
    const st = stanceOf(c, t, run.mods);
    const sMult = stanceDmgMult(st, run.mods);
    const cdMult = st === 'wrath' && run.mods.flags.has('wrath_haste') ? 0.8 : 1;

    if (def.kind === 'beam') {
      const targets = pickTargets(c, tc, stats.range, 1, true);
      if (!targets.length) {
        t.cooldown = 0;
        continue;
      }
      const e = targets[0];
      const crit = Math.random() < stats.critChance;
      t.combatDmg += damageEnemy(g, e, (crit ? stats.damage * run.mods.critDamage : stats.damage) * sMult,
        { pierce: run.mods.armorPierce, crit });
      applyHitEffects(g, e, snapshotEffects(g, t.defId));
      // visuel : pointillés lumineux le long du rayon
      const steps = 6;
      for (let k = 1; k <= steps; k++) {
        c.particles.push({
          x: tc.x + ((e.pos.x - tc.x) * k) / steps,
          y: tc.y - 10 + ((e.pos.y - tc.y + 10) * k) / steps,
          vx: 0, vy: 0, t: 0, life: 0.14, color: '#ffe9a8', size: 2.2,
        });
      }
      playSfx('zap');
      if (e.hp <= 0 && e.alive) killEnemy(g, e, t.uid);
      t.cooldown += stats.cooldown * cdMult;
      continue;
    }

    if (def.kind === 'pulse') {
      const targets = pickTargets(c, tc, stats.range, 999);
      if (!targets.length) {
        t.cooldown = 0;
        continue;
      }
      const fx = snapshotEffects(g, t.defId);
      if (stats.slow) fx.slow = stats.slow;
      for (const e of targets) {
        if (stats.damage > 0) {
          const crit = Math.random() < stats.critChance;
          t.combatDmg += damageEnemy(g, e, (crit ? stats.damage * run.mods.critDamage : stats.damage) * sMult,
            { pierce: run.mods.armorPierce, crit, quiet: targets.length > 6 });
        }
        if (def.mark) e.mark = { amp: def.mark.amp, t: def.mark.duration };
        applyHitEffects(g, e, fx);
        if (e.hp <= 0 && e.alive) killEnemy(g, e, t.uid);
      }
      c.particles.push({
        x: tc.x, y: tc.y, vx: 0, vy: 0, t: 0, life: 0.35,
        color: def.classId === 'silent' ? '#7de08a' : '#ffb26b', size: 3, ring: true, maxR: stats.range,
      });
      playSfx('pulse');
      t.cooldown += stats.cooldown * cdMult;
      continue;
    }

    // projectile
    const targets = pickTargets(c, tc, stats.range, stats.targets, true);
    if (!targets.length) {
      t.cooldown = 0;
      continue;
    }
    playSfx('shoot');
    const splashBoost = def.splash && run.mods.splashAmp > 0 ? 1 + run.mods.splashAmp : 1;
    for (const target of targets) {
      const crit = Math.random() < stats.critChance;
      const dmg = (crit ? stats.damage * run.mods.critDamage : stats.damage) * sMult * splashBoost;
      fireProjectile(g, t, target, dmg, crit);
      if (def.id === 'frappe' && run.mods.flags.has('frappe_double')) {
        const crit2 = Math.random() < stats.critChance;
        fireProjectile(g, t, target, (crit2 ? stats.damage * run.mods.critDamage : stats.damage) * sMult, crit2);
      }
    }
    t.cooldown += stats.cooldown * cdMult;
  }
}

function updateProjectiles(g: Game, dt: number): void {
  const c = g.combat!;
  const run = g.run!;
  for (let i = c.projectiles.length - 1; i >= 0; i--) {
    const p = c.projectiles[i];
    const target = c.enemies.find((e) => e.uid === p.targetUid && e.alive);
    const dest = target ? target.pos : p.lastPos;
    if (target) p.lastPos = { ...target.pos };
    const dx = dest.x - p.x;
    const dy = dest.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    const hitRadius = target ? target.def.radius + 4 : 6;
    if (d <= step + hitRadius) {
      // impact — libère la réservation anti-overkill
      if (target) target.incoming = Math.max(0, target.incoming - p.damage);
      const impact = { x: dest.x, y: dest.y };
      const victims: EnemyInst[] = [];
      if (p.splash > 0) {
        for (const e of c.enemies) {
          if (e.alive && Math.hypot(e.pos.x - impact.x, e.pos.y - impact.y) <= p.splash + e.def.radius) {
            victims.push(e);
          }
        }
        c.particles.push({
          x: impact.x, y: impact.y, vx: 0, vy: 0, t: 0, life: 0.3,
          color: p.color, size: 4, ring: true, maxR: p.splash,
        });
      } else if (target) {
        victims.push(target);
      }
      const srcTower = p.sourceUid != null ? run.towers.find((t) => t.uid === p.sourceUid) : undefined;
      for (const e of victims) {
        const dealt = damageEnemy(g, e, p.damage, { pierce: p.effects.armorPierce, ignoreArmor: p.effects.ignoreArmor, crit: p.crit });
        if (srcTower) srcTower.combatDmg += dealt;
        applyHitEffects(g, e, p.effects);
        if (e.hp <= 0 && e.alive) killEnemy(g, e, p.sourceUid);
      }
      // foudre en chaîne : rebondit vers l'ennemi valide le plus proche
      if (p.chain && p.chain.jumps > 0 && target) {
        const hit = p.hitUids ?? [];
        hit.push(target.uid);
        let best: EnemyInst | null = null;
        let bestD = Infinity;
        for (const e of c.enemies) {
          if (!e.alive || hit.includes(e.uid)) continue;
          const d2 = Math.hypot(e.pos.x - impact.x, e.pos.y - impact.y);
          if (d2 <= p.chain.range && d2 < bestD) {
            bestD = d2;
            best = e;
          }
        }
        if (best) {
          const dmg2 = p.damage * p.chain.decay;
          c.projectiles.push({
            x: impact.x, y: impact.y, speed: 640, targetUid: best.uid, lastPos: { ...best.pos },
            damage: dmg2, crit: false, splash: 0,
            effects: { armorPierce: p.effects.armorPierce, ignoreArmor: p.effects.ignoreArmor },
            color: '#9be3ff', size: 2.5,
            chain: { jumps: p.chain.jumps - 1, range: p.chain.range, decay: p.chain.decay },
            hitUids: hit,
            sourceUid: p.sourceUid,
          });
          best.incoming += dmg2;
          playSfx('zap');
        }
      }
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        c.particles.push({
          x: impact.x, y: impact.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
          t: 0, life: 0.2, color: p.color, size: 2,
        });
      }
      c.projectiles.splice(i, 1);
      continue;
    }
    p.x += (dx / (d || 1)) * step;
    p.y += (dy / (d || 1)) * step;
  }
  void run;
}

// ---------- Effets visuels ----------

export function addFloater(c: CombatState, x: number, y: number, txt: string, color: string, scale = 1): void {
  if (c.floaters.length > 70) return;
  c.floaters.push({ x: x + (Math.random() * 10 - 5), y, txt, color, t: 0, life: 0.9, scale });
}

function updateFx(c: CombatState, dt: number): void {
  if (c.shake > 0) c.shake = Math.max(0, c.shake - dt);
  for (let i = c.particles.length - 1; i >= 0; i--) {
    const p = c.particles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.t >= p.life) c.particles.splice(i, 1);
  }
  for (let i = c.floaters.length - 1; i >= 0; i--) {
    const f = c.floaters[i];
    f.t += dt;
    f.y -= 26 * dt;
    if (f.t >= f.life) c.floaters.splice(i, 1);
  }
}

// ---------- Boucle principale du combat ----------

export function updateCombat(g: Game, dt: number): void {
  const c = g.combat;
  if (!c || !g.run) return;
  c.time += dt;
  updateFx(c, dt);
  if (c.phase !== 'wave' || g.paused) return;

  c.waveTime += dt;
  while (c.spawnQueue.length && c.spawnQueue[0].time <= c.waveTime) {
    const s = c.spawnQueue.shift()!;
    spawnEnemy(g, s.enemyId, s.portalId);
  }

  updateEnemies(g, dt);
  if (c.phase !== 'wave') return; // la run vient d'être perdue
  updateTowers(g, dt);
  updateProjectiles(g, dt);

  // fin de vague ?
  if (!c.spawnQueue.length && !c.enemies.length) {
    const run = g.run;
    const clearedWaveNum = c.waveIndex + 1;
    const interest = interestFor(run);
    const bonus = 4 + clearedWaveNum + run.mods.goldPerWave;
    run.gold += bonus + interest;
    run.stats.goldEarned += bonus + interest;
    run.stats.wavesCleared++;
    c.waveIndex++;
    // Sang Neuf : le Cœur se renforce à chaque vague repoussée
    if (run.mods.flags.has('sang_neuf')) {
      run.mods.heartMaxBonus += 1;
      run.heartHp += 1;
    }
    // Recalibrage : la tour Defect la plus meurtrière gagne +1 dégât permanent
    if (run.mods.flags.has('recalibrage')) {
      let best: TowerInst | null = null;
      for (const t of placedTowers(run)) {
        if (TOWERS[t.defId].classId !== 'defect') continue;
        if (!best || t.kills > best.kills) best = t;
      }
      if (best && best.kills > 0) {
        best.permDmg += 1;
        if (best.cell) {
          addFloater(c, (best.cell.x + 0.5) * CELL, (best.cell.y + 0.5) * CELL - 20, '+1 ⚔', '#9be3ff', 1);
        }
      }
    }
    g.events.push({ type: 'waveCleared', gold: bonus, interest });
    playSfx('waveClear');
    if (c.waveIndex >= c.waves.length) {
      c.phase = 'over';
      g.events.push({ type: 'combatWon' });
    } else {
      c.phase = 'prep';
      refreshActivePortals(c);
      rollShop(g); // rafraîchissement gratuit à chaque préparation
    }
  }
}
