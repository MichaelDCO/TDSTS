import type { MapDef } from '../types';

// Cartes 24x14. Les chemins sont des suites de cases alignées (segments horizontaux/verticaux),
// du portail jusqu'au cœur. Plusieurs chemins peuvent partager un tronçon final (points chauds).
export const MAPS: Record<string, MapDef> = {
  croisee: {
    id: 'croisee',
    name: 'La Croisée',
    heart: { x: 12, y: 7 },
    portals: [
      { id: 'W', waypoints: [{ x: 0, y: 7 }, { x: 5, y: 7 }, { x: 5, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 7 }, { x: 12, y: 7 }] },
      { id: 'N', waypoints: [{ x: 12, y: 0 }, { x: 12, y: 2 }, { x: 16, y: 2 }, { x: 16, y: 5 }, { x: 12, y: 5 }, { x: 12, y: 7 }] },
      { id: 'E', waypoints: [{ x: 23, y: 7 }, { x: 19, y: 7 }, { x: 19, y: 10 }, { x: 15, y: 10 }, { x: 15, y: 7 }, { x: 12, y: 7 }] },
      { id: 'S', waypoints: [{ x: 12, y: 13 }, { x: 12, y: 11 }, { x: 8, y: 11 }, { x: 8, y: 8 }, { x: 12, y: 8 }, { x: 12, y: 7 }] },
    ],
  },
  fourche: {
    id: 'fourche',
    name: 'La Fourche Corrompue',
    heart: { x: 19, y: 7 },
    portals: [
      { id: 'W1', waypoints: [{ x: 0, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 7 }, { x: 14, y: 7 }, { x: 19, y: 7 }] },
      { id: 'W2', waypoints: [{ x: 0, y: 10 }, { x: 8, y: 10 }, { x: 8, y: 7 }, { x: 14, y: 7 }, { x: 19, y: 7 }] },
      { id: 'N', waypoints: [{ x: 10, y: 0 }, { x: 10, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 7 }, { x: 19, y: 7 }] },
    ],
  },
  spirale: {
    id: 'spirale',
    name: 'La Spirale d’Os',
    heart: { x: 12, y: 7 },
    portals: [
      { id: 'C1', waypoints: [{ x: 0, y: 0 }, { x: 11, y: 0 }, { x: 11, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 7 }, { x: 12, y: 7 }] },
      { id: 'C2', waypoints: [{ x: 23, y: 0 }, { x: 17, y: 0 }, { x: 17, y: 5 }, { x: 14, y: 5 }, { x: 14, y: 7 }, { x: 12, y: 7 }] },
      { id: 'C3', waypoints: [{ x: 23, y: 13 }, { x: 13, y: 13 }, { x: 13, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 7 }, { x: 12, y: 7 }] },
      { id: 'C4', waypoints: [{ x: 0, y: 13 }, { x: 5, y: 13 }, { x: 5, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 7 }, { x: 12, y: 7 }] },
    ],
  },
  sanctuaire: {
    id: 'sanctuaire',
    name: 'Le Sanctuaire du Cœur',
    heart: { x: 12, y: 7 },
    portals: [
      { id: 'W', waypoints: [{ x: 0, y: 7 }, { x: 4, y: 7 }, { x: 4, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 7 }, { x: 12, y: 7 }] },
      { id: 'E', waypoints: [{ x: 23, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 10 }, { x: 16, y: 10 }, { x: 16, y: 7 }, { x: 12, y: 7 }] },
      { id: 'N1', waypoints: [{ x: 6, y: 0 }, { x: 6, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 7 }, { x: 12, y: 7 }] },
      { id: 'N2', waypoints: [{ x: 18, y: 0 }, { x: 18, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 7 }, { x: 12, y: 7 }] },
      { id: 'S1', waypoints: [{ x: 6, y: 13 }, { x: 6, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 7 }, { x: 12, y: 7 }] },
      { id: 'S2', waypoints: [{ x: 18, y: 13 }, { x: 18, y: 11 }, { x: 14, y: 11 }, { x: 14, y: 7 }, { x: 12, y: 7 }] },
    ],
  },
};
