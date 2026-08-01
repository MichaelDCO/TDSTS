import type { AugmentDef } from '../types';

// ~30 augments : généraux + spécifiques Ironclad / Silencieuse.
// `stackable` = peut être proposé et pris plusieurs fois.
export const AUGMENTS: Record<string, AugmentDef> = {
  // ---------- GÉNÉRAUX (communs) ----------
  veteran: {
    id: 'veteran', name: 'Vétéran', glyph: '🛡️', classId: 'general', rarity: 'common', stackable: true,
    desc: 'Toutes vos tours infligent +10 % de dégâts.',
    apply: (_r, m) => { m.dmgMult += 0.10; },
  },
  longue_vue: {
    id: 'longue_vue', name: 'Longue-Vue', glyph: '🔭', classId: 'general', rarity: 'common', stackable: true,
    desc: '+12 % de portée pour toutes vos tours.',
    apply: (_r, m) => { m.rangeMult += 0.12; },
  },
  reflexes: {
    id: 'reflexes', name: 'Réflexes', glyph: '⚡', classId: 'general', rarity: 'common', stackable: true,
    desc: '+10 % de vitesse d’attaque pour toutes vos tours.',
    apply: (_r, m) => { m.atkSpeedMult += 0.10; },
  },
  economie: {
    id: 'economie', name: 'Économie de Guerre', glyph: '🪙', classId: 'general', rarity: 'common',
    desc: '+1 or par ennemi éliminé.',
    apply: (_r, m) => { m.goldPerKill += 1; },
  },
  tresorier: {
    id: 'tresorier', name: 'Trésorier', glyph: '🏦', classId: 'general', rarity: 'common',
    desc: 'Le plafond d’intérêts passe de 5 à 8 (1 or par tranche de 10 en réserve, à chaque vague).',
    apply: (_r, m) => { m.interestCap += 3; },
  },
  marchandage: {
    id: 'marchandage', name: 'Marchandage', glyph: '🤝', classId: 'general', rarity: 'common',
    desc: 'Relancer la boutique ne coûte plus que 1 or.',
    apply: (_r, m) => { m.rerollCost = 1; },
  },
  fortifications: {
    id: 'fortifications', name: 'Fortifications', glyph: '🏰', classId: 'general', rarity: 'common',
    desc: '+15 PV max au Cœur de la Flèche, et soigne 15 PV immédiatement.',
    apply: (r, m) => { m.heartMaxBonus += 15; r.heartHp += 15; },
  },
  aubaine: {
    id: 'aubaine', name: 'Aubaine', glyph: '💰', classId: 'general', rarity: 'common', stackable: true,
    desc: 'Gagnez 25 or immédiatement.',
    apply: (r, _m) => { r.gold += 25; },
  },
  percant: {
    id: 'percant', name: 'Pointes Perçantes', glyph: '📌', classId: 'general', rarity: 'common',
    desc: 'Les attaques de vos tours ignorent 2 points d’armure.',
    apply: (_r, m) => { m.armorPierce += 2; },
  },
  critique: {
    id: 'critique', name: 'Œil du Tueur', glyph: '👁️', classId: 'general', rarity: 'common', stackable: true,
    desc: '+10 % de chance de coup critique (dégâts ×2).',
    apply: (_r, m) => { m.critChance += 0.10; },
  },
  prosperite: {
    id: 'prosperite', name: 'Prospérité', glyph: '🌾', classId: 'general', rarity: 'common',
    desc: '+2 or fixes à la fin de chaque vague.',
    apply: (_r, m) => { m.goldPerWave += 2; },
  },
  // ---------- GÉNÉRAUX (rares) ----------
  boutique_luxe: {
    id: 'boutique_luxe', name: 'Boutique de Luxe', glyph: '🛒', classId: 'general', rarity: 'rare',
    desc: '+1 emplacement en boutique.',
    apply: (_r, m) => { m.shopSlots += 1; },
  },
  pacte_sanglant: {
    id: 'pacte_sanglant', name: 'Pacte Sanglant', glyph: '🖤', classId: 'general', rarity: 'rare',
    desc: 'Le Cœur perd 10 PV max, mais toutes vos tours gagnent +20 % de dégâts.',
    apply: (r, m) => { m.heartMaxBonus -= 10; r.heartHp = Math.max(1, r.heartHp - 10); m.dmgMult += 0.20; },
  },
  apprentissage: {
    id: 'apprentissage', name: 'Apprentissage', glyph: '📖', classId: 'general', rarity: 'rare',
    desc: 'Vos tours gagnent +1 % de dégâts par vague terminée depuis le début de la run (rétroactif).',
    apply: (_r, m) => { m.dmgPerWaveCleared += 0.01; },
  },
  contrebande: {
    id: 'contrebande', name: 'Contrebande', glyph: '📦', classId: 'general', rarity: 'rare',
    desc: 'La boutique peut désormais proposer les tours de l’autre classe.',
    apply: (_r, m) => { m.crossClassShop = true; },
  },

  // ---------- IRONCLAD ----------
  force_demo: {
    id: 'force_demo', name: 'Forme Démoniaque', glyph: '😈', classId: 'ironclad', rarity: 'common', stackable: true,
    desc: 'Les tours Ironclad gagnent +3 dégâts fixes par attaque.',
    apply: (_r, m) => { m.flatDmgByClass.ironclad = (m.flatDmgByClass.ironclad ?? 0) + 3; },
  },
  saignement_v: {
    id: 'saignement_v', name: 'Plaies Ouvertes', glyph: '🩸', classId: 'ironclad', rarity: 'common',
    desc: 'Le Saignement dure 2 secondes de plus.',
    apply: (_r, m) => { m.bleedDurationBonus += 2; },
  },
  immolation: {
    id: 'immolation', name: 'Immolation', glyph: '🔥', classId: 'ironclad', rarity: 'common',
    desc: 'Les dégâts de Brûlure sont augmentés de 60 %.',
    apply: (_r, m) => { m.burnMult += 0.6; },
  },
  rage_sang: {
    id: 'rage_sang', name: 'Rage du Sang', glyph: '❤️‍🔥', classId: 'ironclad', rarity: 'common',
    desc: 'Le Cœur récupère 5 PV supplémentaires après chaque combat.',
    apply: (_r, m) => { m.healPerCombat += 5; },
  },
  hemorragie: {
    id: 'hemorragie', name: 'Hémorragie', glyph: '💉', classId: 'ironclad', rarity: 'rare',
    desc: 'Les ennemis qui saignent subissent +15 % de dégâts de toutes les sources.',
    apply: (_r, m) => { m.bleedAmpTaken += 0.15; },
  },
  double_frappe: {
    id: 'double_frappe', name: 'Double Frappe', glyph: '⚔️', classId: 'ironclad', rarity: 'rare',
    desc: 'Les tours Frappe Lourde attaquent deux fois par salve.',
    apply: (_r, m) => { m.flags.add('frappe_double'); },
  },
  berserk: {
    id: 'berserk', name: 'Berserk', glyph: '💢', classId: 'ironclad', rarity: 'rare',
    desc: 'Quand le Cœur est sous 50 % de ses PV, vos tours gagnent +25 % de vitesse d’attaque.',
    apply: (_r, m) => { m.atkSpeedBelowHalf += 0.25; },
  },
  cyclone: {
    id: 'cyclone', name: 'Cyclone', glyph: '🌀', classId: 'ironclad', rarity: 'rare',
    desc: 'Les Tourbillons gagnent +40 % de portée et ralentissent les ennemis touchés de 20 %.',
    apply: (_r, m) => { m.flags.add('tourbillon_cyclone'); },
  },

  // ---------- LA SILENCIEUSE ----------
  poison_conc: {
    id: 'poison_conc', name: 'Poison Concentré', glyph: '🧪', classId: 'silent', rarity: 'common', stackable: true,
    desc: 'Le Poison inflige +50 % de dégâts par seconde.',
    apply: (_r, m) => { m.poisonMult += 0.5; },
  },
  accumulation: {
    id: 'accumulation', name: 'Accumulation', glyph: '⚗️', classId: 'silent', rarity: 'common', stackable: true,
    desc: 'Les attaques qui empoisonnent appliquent +1 pile de Poison.',
    apply: (_r, m) => { m.poisonExtraStacks += 1; },
  },
  precision: {
    id: 'precision', name: 'Précision Mortelle', glyph: '🎯', classId: 'silent', rarity: 'common',
    desc: 'Les tours de la Silencieuse gagnent +15 % de chance de critique.',
    apply: (_r, m) => { m.critChanceByClass.silent = (m.critChanceByClass.silent ?? 0) + 0.15; },
  },
  ombre: {
    id: 'ombre', name: 'Danse des Ombres', glyph: '🌑', classId: 'silent', rarity: 'common',
    desc: 'Les tours de la Silencieuse gagnent +15 % de vitesse d’attaque.',
    apply: (_r, m) => { m.atkSpeedByClass.silent = (m.atkSpeedByClass.silent ?? 0) + 0.15; },
  },
  toxines: {
    id: 'toxines', name: 'Toxines Volatiles', glyph: '💥', classId: 'silent', rarity: 'rare',
    desc: 'Un ennemi qui meurt empoisonné répand son poison sur les ennemis proches.',
    apply: (_r, m) => { m.poisonExplode = true; },
  },
  mille_coups: {
    id: 'mille_coups', name: 'Mille Coups', glyph: '🗡️', classId: 'silent', rarity: 'rare',
    desc: 'Les Lance-Dagues touchent une cible supplémentaire.',
    apply: (_r, m) => { m.flags.add('dague_extra'); },
  },
  venin_persistant: {
    id: 'venin_persistant', name: 'Venin Persistant', glyph: '🐍', classId: 'silent', rarity: 'rare',
    desc: 'Le Poison ne se dissipe plus avec le temps.',
    apply: (_r, m) => { m.poisonNoDecay = true; },
  },
  huile_noire: {
    id: 'huile_noire', name: 'Huile Noire', glyph: '🛢️', classId: 'silent', rarity: 'rare',
    desc: 'Tous vos ralentissements sont 12 % plus puissants.',
    apply: (_r, m) => { m.slowBonus += 0.12; },
  },

  // ---------- LE DEFECT ----------
  surcharge: {
    id: 'surcharge', name: 'Surcharge', glyph: '⚡', classId: 'defect', rarity: 'common', stackable: true,
    desc: 'Les tours du Defect infligent +12 % de dégâts.',
    apply: (_r, m) => { m.dmgMultByClass.defect = (m.dmgMultByClass.defect ?? 0) + 0.12; },
  },
  condensat: {
    id: 'condensat', name: 'Composants Améliorés', glyph: '🔧', classId: 'defect', rarity: 'common', stackable: true,
    desc: 'Les tours du Defect gagnent +3 dégâts fixes par attaque.',
    apply: (_r, m) => { m.flatDmgByClass.defect = (m.flatDmgByClass.defect ?? 0) + 3; },
  },
  turbo: {
    id: 'turbo', name: 'Surcadençage', glyph: '⏩', classId: 'defect', rarity: 'common',
    desc: 'Les tours du Defect gagnent +15 % de vitesse d’attaque.',
    apply: (_r, m) => { m.atkSpeedByClass.defect = (m.atkSpeedByClass.defect ?? 0) + 0.15; },
  },
  givre_noir: {
    id: 'givre_noir', name: 'Givre Mordant', glyph: '🧊', classId: 'defect', rarity: 'common',
    desc: 'Les ennemis ralentis subissent +12 % de dégâts de toutes les sources.',
    apply: (_r, m) => { m.slowedAmpTaken += 0.12; },
  },
  eclats_statiques: {
    id: 'eclats_statiques', name: 'Éclats Statiques', glyph: '✨', classId: 'defect', rarity: 'common',
    desc: 'Les tours du Defect gagnent +15 % de chance de critique.',
    apply: (_r, m) => { m.critChanceByClass.defect = (m.critChanceByClass.defect ?? 0) + 0.15; },
  },
  conductivite: {
    id: 'conductivite', name: 'Conductivité', glyph: '🔌', classId: 'defect', rarity: 'rare',
    desc: 'Les rebonds d’éclair ne perdent plus de puissance.',
    apply: (_r, m) => { m.flags.add('chain_full'); },
  },
  double_orbe: {
    id: 'double_orbe', name: 'Double Orbe', glyph: '🔵', classId: 'defect', rarity: 'rare',
    desc: 'Les éclairs de vos Orbes de Foudre font un rebond supplémentaire.',
    apply: (_r, m) => { m.flags.add('chain_extra'); },
  },
  recalibrage: {
    id: 'recalibrage', name: 'Recalibrage', glyph: '📈', classId: 'defect', rarity: 'rare',
    desc: 'À chaque fin de vague, votre tour du Defect avec le plus d’éliminations gagne +1 dégât permanent.',
    apply: (_r, m) => { m.flags.add('recalibrage'); },
  },

  // ---------- LA WATCHER ----------
  ferveur: {
    id: 'ferveur', name: 'Ferveur', glyph: '🕉️', classId: 'watcher', rarity: 'common', stackable: true,
    desc: 'Les tours de la Watcher infligent +12 % de dégâts.',
    apply: (_r, m) => { m.dmgMultByClass.watcher = (m.dmgMultByClass.watcher ?? 0) + 0.12; },
  },
  poigne: {
    id: 'poigne', name: 'Poigne de Fer', glyph: '✊', classId: 'watcher', rarity: 'common', stackable: true,
    desc: 'Les tours de la Watcher gagnent +3 dégâts fixes par attaque.',
    apply: (_r, m) => { m.flatDmgByClass.watcher = (m.flatDmgByClass.watcher ?? 0) + 3; },
  },
  calme_profond: {
    id: 'calme_profond', name: 'Calme Profond', glyph: '🧘', classId: 'watcher', rarity: 'common',
    desc: 'La posture Calme ne réduit presque plus les dégâts (×0,85 au lieu de ×0,7).',
    apply: (_r, m) => { m.flags.add('calm_strong'); },
  },
  troisieme_oeil: {
    id: 'troisieme_oeil', name: 'Troisième Œil', glyph: '🔮', classId: 'watcher', rarity: 'common',
    desc: 'Les tours de la Watcher gagnent +15 % de chance de critique.',
    apply: (_r, m) => { m.critChanceByClass.watcher = (m.critChanceByClass.watcher ?? 0) + 0.15; },
  },
  pressentiment: {
    id: 'pressentiment', name: 'Pressentiment', glyph: '🃏', classId: 'watcher', rarity: 'common',
    desc: '+1 relance gratuite à chaque écran d’augment.',
    apply: (_r, m) => { m.augRerolls += 1; },
  },
  colere_prolongee: {
    id: 'colere_prolongee', name: 'Colère Prolongée', glyph: '😡', classId: 'watcher', rarity: 'rare',
    desc: 'La posture Colère dure 1 seconde de plus.',
    apply: (_r, m) => { m.flags.add('wrath_long'); },
  },
  illumination: {
    id: 'illumination', name: 'Illumination', glyph: '💡', classId: 'watcher', rarity: 'rare',
    desc: 'Pendant la Colère, les tours de la Watcher attaquent 25 % plus vite.',
    apply: (_r, m) => { m.flags.add('wrath_haste'); },
  },
  marche_vide: {
    id: 'marche_vide', name: 'Marche du Vide', glyph: '🌌', classId: 'watcher', rarity: 'rare',
    desc: 'Les ennemis éliminés par une tour en Colère rapportent +1 or.',
    apply: (_r, m) => { m.flags.add('wrath_gold'); },
  },
};

export function augmentsForClass(classId: string, crossClass = false): AugmentDef[] {
  return Object.values(AUGMENTS).filter(
    (a) => a.classId === 'general' || a.classId === classId || crossClass,
  );
}
