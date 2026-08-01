// ---------- Constantes globales ----------

export const COLS = 24;
export const ROWS = 14;
export const CELL = 48;
export const W = COLS * CELL; // 1152
export const H = ROWS * CELL; // 672

export const HEART_BASE_HP = 60;
export const START_GOLD = 12;
export const BASE_SHOP_SLOTS = 5;
export const BASE_REROLL_COST = 2;
export const BASE_INTEREST_CAP = 5;
export const BASE_HEAL_PER_COMBAT = 4;
export const BENCH_CAP = 30;
export const TOTAL_COMBATS = 10;

export const RARITY_COLORS: Record<string, string> = {
  common: '#9aa5b1',
  uncommon: '#4fa3ff',
  rare: '#c98bff',
};

export const RARITY_NAMES: Record<string, string> = {
  common: 'Commune',
  uncommon: 'Rare',
  rare: 'Épique',
};

export const CLASS_COLORS: Record<string, string> = {
  ironclad: '#e05545',
  silent: '#5fbf6e',
  neutral: '#d9b96a',
  general: '#d9c88f',
};

export const CLASS_NAMES: Record<string, string> = {
  ironclad: 'Ironclad',
  silent: 'La Silencieuse',
  neutral: 'Neutre',
  general: 'Général',
};

// Probabilités de rareté en boutique par combat (common / uncommon / rare)
export const SHOP_ODDS: [number, number, number][] = [
  [80, 18, 2],
  [74, 23, 3],
  [67, 28, 5],
  [60, 32, 8],
  [54, 34, 12],
  [48, 36, 16],
  [42, 38, 20],
  [37, 38, 25],
  [33, 38, 29],
  [30, 37, 33],
];

// Multiplicateur de PV des ennemis par combat (index 0 = combat 1)
export function combatHpMult(c: number): number {
  return 1 + 0.33 * (c - 1) + 0.042 * (c - 1) * (c - 1);
}

// Nombre max de tours déployées simultanément (à la TFT : le plateau est limité)
export function deployCap(c: number): number {
  return 7 + c;
}

// Or maximum gagné par éliminations au cours d'une même vague
export function killGoldCap(c: number): number {
  return 14 + c;
}

// Multiplicateur de PV par vague au sein d'un combat
export function waveHpMult(w: number): number {
  return 1 + 0.1 * (w - 1);
}

export function keyOf(x: number, y: number): string {
  return x + ',' + y;
}
