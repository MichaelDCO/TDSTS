import type { ClassId } from '../types';

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  color: string;
  glyph: string;
  desc: string;
  passiveName: string;
  passiveDesc: string;
  startingTowers: string[]; // defIds placés en réserve au départ
  extraShopSlots: number;
  extraHealPerCombat: number;
  extraDeploy: number;
  scryWaves: number; // vagues supplémentaires visibles dans l'aperçu (Divination)
}

export const ALL_CLASS_IDS: ClassId[] = ['ironclad', 'silent', 'defect', 'watcher'];

export const CLASSES: Record<ClassId, ClassDef> = {
  ironclad: {
    id: 'ironclad',
    name: 'Ironclad',
    title: 'Le soldat déchu',
    color: '#e05545',
    glyph: '🛡️',
    desc: 'Dégâts bruts, saignement, feu et zones. Encaisse et cogne.',
    passiveName: 'Sang Brûlant',
    passiveDesc: 'Le Cœur récupère 8 PV après chaque combat (au lieu de 3).',
    startingTowers: ['frappe', 'frappe', 'tourbillon'],
    extraShopSlots: 0,
    extraHealPerCombat: 5,
    extraDeploy: 0,
    scryWaves: 0,
  },
  silent: {
    id: 'silent',
    name: 'La Silencieuse',
    title: 'La chasseresse des marais',
    color: '#5fbf6e',
    glyph: '🐍',
    desc: 'Poison qui s’accumule, dagues rapides, ralentissements et critiques.',
    passiveName: 'Anneau du Serpent',
    passiveDesc: 'La boutique propose en permanence 1 tour de plus (6 au lieu de 5).',
    startingTowers: ['dague', 'dague', 'fiole'],
    extraShopSlots: 1,
    extraHealPerCombat: 0,
    extraDeploy: 0,
    scryWaves: 0,
  },
  defect: {
    id: 'defect',
    name: 'Le Defect',
    title: 'L’automate éveillé',
    color: '#5fb7d4',
    glyph: '⚡',
    desc: 'Orbes et machines : foudre en chaîne, givre, rayons perçants et surcadençage.',
    passiveName: 'Focalisation',
    passiveDesc: 'Peut déployer en permanence 1 tour de plus que les autres classes.',
    startingTowers: ['orbe_foudre', 'orbe_foudre', 'orbe_givre'],
    extraShopSlots: 0,
    extraHealPerCombat: 0,
    extraDeploy: 1,
    scryWaves: 0,
  },
  watcher: {
    id: 'watcher',
    name: 'La Watcher',
    title: 'La moniale aux yeux ouverts',
    color: '#b48ad9',
    glyph: '👁️',
    desc: 'Postures : ses tours alternent Calme (retenue) et Colère (dégâts ×2,1). Le rythme est une arme.',
    passiveName: 'Divination',
    passiveDesc: 'L’aperçu « En approche » révèle aussi la vague suivante.',
    startingTowers: ['paume', 'paume', 'roue'],
    extraShopSlots: 0,
    extraHealPerCombat: 0,
    extraDeploy: 0,
    scryWaves: 1,
  },
};
