import type { CombatDef, RNG, SpawnEvent, WaveDef } from '../types';

// ---------- Plan de la run : 10 combats ----------
export const COMBAT_PLAN: CombatDef[] = [
  {
    index: 1, kind: 'normal', name: 'Les Marais Suintants', mapId: 'croisee',
    portalIds: ['W', 'E'], waves: 4, portalActivation: { W: 1, E: 3 },
  },
  {
    index: 2, kind: 'normal', name: 'Le Charnier', mapId: 'fourche',
    portalIds: ['W1', 'W2', 'N'], waves: 4, portalActivation: { W1: 1, W2: 2, N: 4 },
  },
  {
    index: 3, kind: 'normal', name: 'La Ménagerie', mapId: 'labyrinthe',
    portalIds: ['W', 'E', 'N'], waves: 5, portalActivation: { W: 1, E: 2, N: 4 },
  },
  {
    index: 4, kind: 'elite', name: 'ÉLITE — L’Arène du Nob', mapId: 'croisee',
    portalIds: ['N', 'S', 'W'], waves: 5, portalActivation: { N: 1, S: 2, W: 4 },
  },
  {
    index: 5, kind: 'normal', name: 'Les Galeries Moisies', mapId: 'fourche',
    portalIds: ['W1', 'W2', 'N'], waves: 5, portalActivation: { W1: 1, W2: 2, N: 3 },
  },
  {
    index: 6, kind: 'normal', name: 'Le Nid', mapId: 'spirale',
    portalIds: ['C1', 'C2', 'C3', 'C4'], waves: 6, portalActivation: { C1: 1, C2: 2, C3: 4, C4: 5 },
  },
  {
    index: 7, kind: 'elite', name: 'ÉLITE — Le Dormeur', mapId: 'sanctuaire',
    portalIds: ['W', 'E', 'N1', 'S1'], waves: 6, portalActivation: { W: 1, E: 2, N1: 4, S1: 5 },
  },
  {
    index: 8, kind: 'normal', name: 'Les Remparts', mapId: 'labyrinthe',
    portalIds: ['W', 'E', 'N', 'S'], waves: 6, portalActivation: { W: 1, E: 2, N: 3, S: 5 },
  },
  {
    index: 9, kind: 'normal', name: 'L’Avant-Cœur', mapId: 'spirale',
    portalIds: ['C1', 'C2', 'C3', 'C4'], waves: 7, portalActivation: { C1: 1, C2: 2, C3: 3, C4: 5 },
  },
  {
    index: 10, kind: 'boss', name: 'BOSS — Le Roi des Slimes', mapId: 'sanctuaire',
    portalIds: ['W', 'E', 'N1', 'S1', 'N2', 'S2'], waves: 7,
    portalActivation: { W: 1, E: 1, N1: 3, S1: 4, N2: 5, S2: 6 },
  },
];

// ---------- Génération des vagues ----------

// Coût en "points de budget" de chaque ennemi
const COST: Record<string, number> = {
  serpenteau: 0.7, slimeP: 1, gremlinF: 1, byrd: 1.5, slimeM: 2, ver: 2, cultiste: 2, poux: 2,
  mystique: 3, orbe_gardien: 2.5, apparition: 2.5,
  slimeG: 4, gremlinC: 4, sentinelle: 5,
};

// Réservoir d'ennemis disponibles par combat
const POOLS: Record<number, string[]> = {
  1: ['slimeP', 'slimeM'],
  2: ['slimeP', 'slimeM', 'ver', 'gremlinF'],
  3: ['slimeP', 'slimeM', 'ver', 'gremlinF', 'cultiste', 'byrd'],
  4: ['slimeP', 'slimeM', 'ver', 'gremlinF', 'cultiste', 'byrd', 'poux'],
  5: ['slimeM', 'ver', 'gremlinF', 'cultiste', 'byrd', 'poux', 'slimeG', 'gremlinC', 'serpenteau', 'mystique'],
  6: ['slimeM', 'ver', 'gremlinF', 'cultiste', 'byrd', 'poux', 'slimeG', 'gremlinC', 'serpenteau', 'mystique', 'orbe_gardien'],
  7: ['slimeM', 'ver', 'gremlinF', 'cultiste', 'byrd', 'poux', 'slimeG', 'gremlinC', 'mystique', 'orbe_gardien', 'apparition'],
  8: ['slimeM', 'ver', 'cultiste', 'byrd', 'poux', 'slimeG', 'gremlinC', 'sentinelle', 'mystique', 'orbe_gardien', 'apparition'],
  9: ['slimeM', 'ver', 'cultiste', 'byrd', 'poux', 'slimeG', 'gremlinC', 'sentinelle', 'mystique', 'orbe_gardien', 'apparition'],
  10: ['slimeM', 'ver', 'cultiste', 'poux', 'slimeG', 'gremlinC', 'sentinelle', 'orbe_gardien', 'apparition'],
};

// Mini-boss disponibles pour clore les combats normaux (déblocage progressif)
function miniBossPool(index: number): string[] {
  const pool: string[] = [];
  if (index >= 5) pool.push('miniMystique', 'miniRepto');
  if (index >= 6) pool.push('miniAutomate');
  if (index >= 8) pool.push('miniSpectre');
  return pool;
}

function budgetFor(combat: number, wave: number): number {
  return (7 + 2.2 * combat) * (1 + 0.15 * (wave - 1));
}

/**
 * Génère les vagues d'un combat. Les ennemis arrivent par grappes depuis
 * chaque portail actif, en flux régulier avec un peu de jitter.
 */
export function generateWaves(def: CombatDef, rng: RNG): WaveDef[] {
  const waves: WaveDef[] = [];
  for (let w = 1; w <= def.waves; w++) {
    const active = def.portalIds.filter((p) => (def.portalActivation[p] ?? 1) <= w);
    const pool = POOLS[def.index] ?? POOLS[10];
    let budget = budgetFor(def.index, w);
    const spawns: SpawnEvent[] = [];
    // temps courant de spawn par portail (flux parallèles)
    const tPortal: Record<string, number> = {};
    active.forEach((p, i) => (tPortal[p] = 0.4 + i * 0.5));

    let portalIdx = 0;
    let guard = 0;
    while (budget > 0 && guard++ < 200) {
      // choisit un type abordable, en grappe de 2 à 4
      const affordable = pool.filter((e) => COST[e] <= Math.max(budget, 1));
      const type = affordable.length ? rng.pick(affordable) : pool[0];
      const clusterSize = 2 + rng.int(3);
      const portal = active[portalIdx % active.length];
      portalIdx++;
      for (let k = 0; k < clusterSize && budget > 0; k++) {
        spawns.push({ enemyId: type, portalId: portal, time: tPortal[portal] });
        tPortal[portal] += 0.55 + rng.next() * 0.5;
        budget -= COST[type];
      }
      // pause entre grappes sur ce portail
      tPortal[portal] += 0.8 + rng.next() * 0.8;
    }

    // La Gemme Voleuse : objectif bonus occasionnel (dès le combat 3)
    if (def.index >= 3 && rng.chance(0.12)) {
      spawns.push({ enemyId: 'gemme', portalId: active[rng.int(active.length)], time: 2 + rng.next() * 6 });
    }

    // Vague finale : mini-boss (combats normaux tardifs), élite ou boss
    if (w === def.waves) {
      const lastPortal = active[rng.int(active.length)];
      if (def.kind === 'elite') {
        const elite = def.index <= 4 ? 'nob' : 'lagavulin';
        spawns.push({ enemyId: elite, portalId: lastPortal, time: 2.5 });
      } else if (def.kind === 'boss') {
        spawns.push({ enemyId: 'roiSlime', portalId: lastPortal, time: 3 });
        // escorte d'honneur
        for (let k = 0; k < 4; k++) {
          spawns.push({ enemyId: 'slimeG', portalId: active[k % active.length], time: 5 + k * 2 });
        }
      } else {
        const minis = miniBossPool(def.index);
        if (minis.length) {
          spawns.push({ enemyId: rng.pick(minis), portalId: lastPortal, time: 3 });
        }
      }
    }

    spawns.sort((a, b) => a.time - b.time);
    waves.push({ spawns });
  }
  return waves;
}
