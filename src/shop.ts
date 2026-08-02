import { BENCH_CAP, COLS, ROWS, SHOP_ODDS, keyOf } from './const';
import { ALL_CLASS_IDS } from './data/classes';
import { TOWERS, towersOfClass } from './data/towers';
import { MAX_TOWER_LEVEL, addTower, benchTowers, deployCapFor, placedTowers, upgradeCost } from './state';
import type { Game, Rarity, TowerDef, Vec } from './types';

function shopPool(g: Game): TowerDef[] {
  const run = g.run!;
  let pool = [...towersOfClass(run.classId), ...towersOfClass('neutral')];
  if (run.mods.crossClassShop) {
    for (const cid of ALL_CLASS_IDS) {
      if (cid !== run.classId) pool = pool.concat(towersOfClass(cid));
    }
  }
  return pool;
}

function rollRarity(g: Game): Rarity {
  const run = g.run!;
  const odds = SHOP_ODDS[Math.min(run.combatIndex, SHOP_ODDS.length) - 1];
  const r = run.rng.next() * 100;
  if (r < odds[0]) return 'common';
  if (r < odds[0] + odds[1]) return 'uncommon';
  return 'rare';
}

/** Remplit la boutique (gratuit à chaque préparation ; respecte le verrouillage). */
export function rollShop(g: Game, force = false): void {
  const run = g.run!;
  if (run.shopLocked && !force && run.shop.some((s) => s)) return;
  const pool = shopPool(g);
  const slots = run.mods.shopSlots;
  run.shop = [];
  for (let i = 0; i < slots; i++) {
    const rarity = rollRarity(g);
    let candidates = pool.filter((t) => t.rarity === rarity);
    if (!candidates.length) candidates = pool.filter((t) => t.rarity === 'common');
    run.shop.push(run.rng.pick(candidates).id);
  }
}

export function rerollShop(g: Game): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  if (run.gold < run.mods.rerollCost) return false;
  run.gold -= run.mods.rerollCost;
  rollShop(g, true);
  return true;
}

export function buyTower(g: Game, slot: number): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  const defId = run.shop[slot];
  if (!defId) return false;
  const def = TOWERS[defId];
  if (run.gold < def.cost) return false;
  if (benchTowers(run).length >= BENCH_CAP) return false;
  run.gold -= def.cost;
  run.shop[slot] = null;
  addTower(run, defId);
  return true;
}

export function sellTower(g: Game, uid: number): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  const idx = run.towers.findIndex((t) => t.uid === uid);
  if (idx < 0) return false;
  // revente : prix de base + moitié des améliorations investies
  const t = run.towers[idx];
  const invested = t.level >= 2 ? TOWERS[t.defId].cost * 3 : 0;
  const invested3 = t.level >= 3 ? TOWERS[t.defId].cost * 5 : 0;
  run.gold += TOWERS[t.defId].cost + Math.floor((invested + invested3) / 2);
  run.towers.splice(idx, 1);
  if (g.ui.selectedTower === uid) g.ui.selectedTower = null;
  if (g.ui.selectedBench === uid) g.ui.selectedBench = null;
  return true;
}

/** Améliore une tour d'un niveau (⭐, préparation uniquement, max 3). */
export function upgradeTower(g: Game, uid: number): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  const t = run.towers.find((x) => x.uid === uid);
  if (!t || t.level >= MAX_TOWER_LEVEL) return false;
  const cost = upgradeCost(run, t);
  if (run.gold < cost) return false;
  run.gold -= cost;
  t.level++;
  return true;
}

/**
 * Fusionne deux tours identiques (même type, même niveau) de la réserve :
 * l'une absorbe l'autre et gagne +1 niveau ⭐. Préparation uniquement.
 */
export function fuseTowers(g: Game, uid: number): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  const t = run.towers.find((x) => x.uid === uid);
  if (!t || t.placed || t.level >= MAX_TOWER_LEVEL) return false;
  const twin = run.towers.find(
    (x) => x.uid !== uid && !x.placed && x.defId === t.defId && x.level === t.level,
  );
  if (!twin) return false;
  t.level++;
  t.kills += twin.kills;
  t.permDmg = Math.max(t.permDmg, twin.permDmg);
  run.towers.splice(run.towers.indexOf(twin), 1);
  if (g.ui.selectedBench === twin.uid) g.ui.selectedBench = null;
  return true;
}

/** Reprend une tour posée pour la remettre en réserve (préparation uniquement). */
export function pickupTower(g: Game, uid: number): boolean {
  const run = g.run!;
  if (!g.combat || g.combat.phase !== 'prep') return false;
  const t = run.towers.find((x) => x.uid === uid);
  if (!t || !t.placed) return false;
  if (benchTowers(run).length >= BENCH_CAP) return false;
  t.placed = false;
  t.cell = null;
  if (g.ui.selectedTower === uid) g.ui.selectedTower = null;
  return true;
}

export function cellBuildable(g: Game, cell: Vec): boolean {
  const c = g.combat!;
  const run = g.run!;
  if (cell.x < 0 || cell.y < 0 || cell.x >= COLS || cell.y >= ROWS) return false;
  if (c.blocked.has(keyOf(cell.x, cell.y))) return false;
  for (const t of run.towers) {
    if (t.placed && t.cell && t.cell.x === cell.x && t.cell.y === cell.y) return false;
  }
  return true;
}

/** Pose une tour de la réserve. Autorisé en préparation ET en pleine vague (esprit Blight). */
export function placeTower(g: Game, uid: number, cell: Vec): boolean {
  const run = g.run!;
  const c = g.combat;
  if (!c || (c.phase !== 'prep' && c.phase !== 'wave')) return false;
  const t = run.towers.find((x) => x.uid === uid);
  if (!t || t.placed) return false;
  if (placedTowers(run).length >= deployCapFor(run)) return false;
  if (!cellBuildable(g, cell)) return false;
  t.placed = true;
  t.cell = { ...cell };
  t.cooldown = 0;
  return true;
}
