// ---------- Types partagés ----------

export type ClassId = 'ironclad' | 'silent' | 'defect' | 'watcher';
export type TowerClass = ClassId | 'neutral';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type AugRarity = 'common' | 'rare';
export type Screen = 'menu' | 'class' | 'combat' | 'victory' | 'defeat';
export type Phase = 'prep' | 'wave' | 'over';

export interface Vec {
  x: number;
  y: number;
}

// ---------- RNG ----------

export interface RNG {
  next(): number; // [0,1)
  int(n: number): number; // 0..n-1
  pick<T>(arr: T[]): T;
  chance(p: number): boolean;
}

// ---------- Tours ----------

export type TowerKind = 'projectile' | 'pulse' | 'aura' | 'beam';

export interface TowerDef {
  id: string;
  name: string;
  glyph: string;
  classId: TowerClass;
  rarity: Rarity;
  cost: number;
  desc: string;
  kind: TowerKind;
  // stats de base (kind projectile/pulse)
  damage: number;
  cooldown: number; // secondes entre attaques
  range: number; // px
  projectileSpeed?: number;
  targets?: number; // multi-cibles (défaut 1)
  splash?: number; // rayon d'explosion px
  critChance?: number; // 0..1
  ignoreArmor?: boolean;
  armorPierce?: number; // perce N points d'armure (inné à la tour)
  // effets appliqués au contact
  bleed?: { dps: number; duration: number };
  burn?: { dps: number; duration: number };
  poison?: number; // piles par coup
  slow?: { factor: number; duration: number }; // factor 0.3 = -30% vitesse
  mark?: { amp: number; duration: number };
  // auras (kind aura)
  auraBuffDmg?: number; // +% dégâts des tours alliées à portée
  auraBuffSpeed?: number; // +% vitesse d'attaque des tours alliées à portée
  goldAura?: number; // +or par élimination à portée
  // foudre en chaîne (Defect)
  chain?: { jumps: number; range: number; decay: number };
  // postures (Watcher) : alterne Calme (dégâts réduits) et Colère (dégâts amplifiés)
  stance?: boolean;
}

export interface TowerInst {
  uid: number;
  defId: string;
  placed: boolean;
  cell: Vec | null;
  cooldown: number;
  kills: number;
  buffMult: number; // bonus d'aura de dégâts (étendard), recalculé en continu
  speedBuff: number; // bonus d'aura de cadence (condensateur), recalculé en continu
  permDmg: number; // dégâts permanents acquis (Recalibrage)
  combatDmg: number; // dégâts directs infligés durant le combat en cours (récapitulatif)
  level: number; // niveau d'amélioration (1 à 3, +30 % dégâts et +5 % cadence par niveau)
}

// ---------- Ennemis ----------

export type EnemyKind = 'normal' | 'elite' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number; // base au combat 1
  speed: number; // px/s
  armor: number; // réduction fixe par coup
  bounty: number; // or
  heartDmg: number;
  radius: number;
  color: string;
  color2?: string;
  kind: EnemyKind;
  slowImmune?: boolean;
  splitInto?: { id: string; count: number };
  enrage?: { hpPct: number; speedMult: number };
  accelerate?: { every: number; mult: number; cap: number };
  desc?: string;
}

export interface EnemyInst {
  uid: number;
  defId: string;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  portalId: string;
  dist: number; // distance parcourue le long du chemin (px)
  pos: Vec;
  slows: { f: number; t: number }[];
  poisonStacks: number;
  bleed: { dps: number; t: number } | null;
  burn: { dps: number; t: number } | null;
  mark: { amp: number; t: number } | null;
  accelMult: number;
  accelTimer: number;
  enraged: boolean;
  alive: boolean;
  bounty: number;
  heartDmg: number;
  dotTick: number; // accumulateur de dégâts périodiques (affichage)
  incoming: number; // dégâts « en vol » réservés par des projectiles (anti-overkill)
}

// ---------- Projectiles / effets visuels ----------

export interface HitEffects {
  bleed?: { dps: number; duration: number };
  burn?: { dps: number; duration: number };
  poison?: number;
  slow?: { factor: number; duration: number } | null;
  ignoreArmor?: boolean;
  armorPierce: number;
}

export interface Projectile {
  x: number;
  y: number;
  speed: number;
  targetUid: number;
  lastPos: Vec;
  damage: number;
  crit: boolean;
  splash: number;
  effects: HitEffects;
  color: string;
  size: number;
  chain?: { jumps: number; range: number; decay: number };
  hitUids?: number[]; // ennemis déjà touchés par cette chaîne d'éclairs
  sourceUid?: number; // tour d'origine (attribution des éliminations)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
  size: number;
  ring?: boolean;
  maxR?: number;
}

export interface Floater {
  x: number;
  y: number;
  txt: string;
  color: string;
  t: number;
  life: number;
  scale?: number;
}

// ---------- Cartes ----------

export interface PortalDef {
  id: string;
  waypoints: Vec[]; // coordonnées de cases, premier = portail, dernier = cœur
}

export interface MapDef {
  id: string;
  name: string;
  heart: Vec; // case du cœur
  portals: PortalDef[];
}

export interface PathGeom {
  pts: Vec[]; // px
  cum: number[]; // longueurs cumulées
  total: number;
}

// ---------- Combats & vagues ----------

export interface CombatDef {
  index: number; // 1..10
  kind: 'normal' | 'elite' | 'boss';
  name: string;
  mapId: string;
  portalIds: string[];
  waves: number;
  portalActivation: Record<string, number>; // portalId -> n° de vague d'activation (1-based)
}

export interface SpawnEvent {
  enemyId: string;
  portalId: string;
  time: number; // offset depuis le début de la vague
}

export interface WaveDef {
  spawns: SpawnEvent[];
}

// ---------- Augments / modificateurs ----------

export interface Modifiers {
  dmgMult: number;
  dmgMultByClass: Record<string, number>;
  flatDmgByClass: Record<string, number>;
  atkSpeedMult: number;
  atkSpeedByClass: Record<string, number>;
  atkSpeedBelowHalf: number;
  rangeMult: number;
  critChance: number;
  critChanceByClass: Record<string, number>;
  critDamage: number;
  armorPierce: number;
  goldPerKill: number;
  goldPerWave: number;
  interestCap: number;
  rerollCost: number;
  shopSlots: number;
  heartMaxBonus: number;
  healPerCombat: number;
  bleedDurationBonus: number;
  bleedAmpTaken: number;
  burnMult: number;
  poisonMult: number;
  poisonExtraStacks: number;
  poisonNoDecay: boolean;
  poisonExplode: boolean;
  slowBonus: number;
  slowedAmpTaken: number; // les ennemis ralentis subissent +% de dégâts
  dmgPerWaveCleared: number;
  crossClassShop: boolean;
  augRerolls: number; // relances gratuites par écran d'augment
  flags: Set<string>;
}

export interface AugmentDef {
  id: string;
  name: string;
  desc: string;
  classId: ClassId | 'general';
  rarity: AugRarity;
  stackable?: boolean;
  glyph: string;
  apply: (run: RunLike, m: Modifiers) => void;
}

// Interface minimale pour éviter les imports circulaires dans les augments
export interface RunLike {
  heartHp: number;
  gold: number;
  mods: Modifiers;
}

// ---------- État global ----------

export interface RunStats {
  kills: number;
  wavesCleared: number;
  goldEarned: number;
  dmgDealt: number;
}

export interface RunState extends RunLike {
  classId: ClassId;
  seed: number;
  rng: RNG;
  heartHp: number;
  gold: number;
  combatIndex: number; // combat courant 1..10
  towers: TowerInst[];
  augments: string[];
  mods: Modifiers;
  shop: (string | null)[];
  stats: RunStats;
  uidCounter: number;
  deployBonus: number; // emplacements de déploiement achetés (à la TFT)
  shopLocked: boolean; // verrouillage de la boutique (lock TFT)
  ascension: number; // niveau d'Ascension de la run (0 = normal, max 5)
  nodeRisky: boolean; // le combat courant est un nœud « risqué » (+PV ennemis, butin doublé)
  recorded?: boolean; // la fin de run a déjà été archivée (localStorage)
}

export interface CombatState {
  def: CombatDef;
  map: MapDef;
  paths: Record<string, PathGeom>;
  blocked: Set<string>; // "x,y" cases non constructibles
  waveIndex: number; // 0-based : prochaine vague à lancer / vague en cours
  phase: Phase;
  waveTime: number;
  spawnQueue: SpawnEvent[];
  waves: WaveDef[];
  enemies: EnemyInst[];
  projectiles: Projectile[];
  particles: Particle[];
  floaters: Floater[];
  activePortals: Set<string>;
  hpMult: number;
  time: number;
  waveKillGold: number; // or gagné par éliminations durant la vague en cours (plafonné)
  shake: number; // secousse d'écran restante (secondes), déclenchée quand le Cœur encaisse
}

export type GameEvent =
  | { type: 'combatWon' }
  | { type: 'runLost' }
  | { type: 'waveCleared'; gold: number; interest: number }
  | { type: 'uiRefresh' };

export interface UIState {
  selectedBench: number | null; // uid de la tour en réserve à placer
  selectedTower: number | null; // uid de la tour posée sélectionnée
  hoverCell: Vec | null;
  hoverTower: number | null;
  pendingCell: Vec | null; // tactile : case en attente de confirmation (2e tap)
}

export interface Game {
  screen: Screen;
  run: RunState | null;
  combat: CombatState | null;
  ui: UIState;
  speed: number;
  paused: boolean;
  events: GameEvent[];
}
