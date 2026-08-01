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
}

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
  },
};
