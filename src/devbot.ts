// Bot de playtest automatisé — chargé uniquement en mode dev (voir main.ts).
// Usage console : __bot({ classIdx: 0, cheatGold: 0, deployAt: 80, smartAug: true })
// Joue une run complète en headless et renvoie un rapport par combat.
import { startWave, updateCombat } from './combat';
import { TOWERS } from './data/towers';
import { buyTower, placeTower, rerollShop, sellTower } from './shop';
import { benchTowers, buyDeploySlot, placedTowers } from './state';
import type { CombatState, Game } from './types';

interface BotOpts {
  classIdx?: number; // 0 = Ironclad, 1 = Silencieuse
  cheatGold?: number;
  deployAt?: number; // acheter un slot de déploiement dès que l'or dépasse ce seuil
  smartAug?: boolean;
}

// Priorités d'augments par classe : le bot joue les synergies (poison pour la
// Silencieuse, multiplicateurs bruts pour l'Ironclad).
const AUG_PRIO_BY_CLASS: Record<string, string[]> = {
  ironclad: [
    'pacte_sanglant', 'veteran', 'force_demo', 'double_frappe', 'hemorragie', 'apprentissage',
    'reflexes', 'critique', 'berserk', 'immolation', 'longue_vue', 'percant', 'saignement_v',
  ],
  silent: [
    'accumulation', 'poison_conc', 'venin_persistant', 'toxines', 'pacte_sanglant', 'veteran',
    'apprentissage', 'ombre', 'mille_coups', 'precision', 'reflexes', 'critique', 'huile_noire',
    'longue_vue', 'percant',
  ],
  defect: [
    'surcharge', 'condensat', 'double_orbe', 'conductivite', 'recalibrage', 'turbo',
    'givre_noir', 'eclats_statiques', 'pacte_sanglant', 'veteran', 'apprentissage',
    'reflexes', 'critique', 'longue_vue', 'percant',
  ],
};

function cost(defId: string): number {
  return TOWERS[defId]?.cost ?? 3;
}

function bestSpots(c: CombatState): { x: number; y: number; cov: number }[] {
  const paths = [...c.blocked].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x: (x + 0.5) * 48, y: (y + 0.5) * 48 };
  });
  const scored: { x: number; y: number; cov: number }[] = [];
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 14; y++) {
      if (c.blocked.has(x + ',' + y)) continue;
      const cx = (x + 0.5) * 48;
      const cy = (y + 0.5) * 48;
      let cov = 0;
      for (const p of paths) if (Math.hypot(p.x - cx, p.y - cy) <= 150) cov++;
      if (cov > 0) scored.push({ x, y, cov });
    }
  }
  return scored.sort((a, b) => b.cov - a.cov);
}

export function installDevBot(g: Game): void {
  (window as unknown as Record<string, unknown>).__bot = (opts: BotOpts = {}) => {
    const o = { classIdx: 0, cheatGold: 0, deployAt: 80, smartAug: true, ...opts };
    const $ = (id: string) => document.getElementById(id);
    const w = window as unknown as Record<string, unknown>;
    w.__botRunning = true; // les runs du bot ne polluent pas l'archive localStorage
    try {

    // reset : depuis le menu, un combat en cours ou un écran de fin
    if ($('btn-play')) $('btn-play')!.click();
    else {
      g.screen = g.run && g.run.heartHp <= 0 ? 'defeat' : 'victory';
      // renderEndScreen gère l'absence de run en revenant au menu
      const anyUi = (window as unknown as Record<string, { openDefeat?: () => void }>).__rtd;
      anyUi?.openDefeat?.();
      $('btn-again')?.click();
      $('btn-play')?.click();
    }
    document.querySelectorAll<HTMLButtonElement>('.class-card button')[o.classIdx]?.click();
    if (g.screen !== 'combat' || !g.run || g.run.combatIndex !== 1) return 'RESET FAILED: ' + g.screen;
    if (o.cheatGold) g.run.gold = o.cheatGold;

    const report: unknown[] = [];
    let guard = 0;
    while (guard++ < 12) {
      const c = g.combat!;
      const spots = bestSpots(c);
      while (c.phase === 'prep') {
        const run = g.run;
        if (run.gold >= o.deployAt) buyDeploySlot(run);
        let bench = benchTowers(run);
        while (bench.length > 24) {
          const junk = bench.sort((a, b) => cost(a.defId) - cost(b.defId))[0];
          sellTower(g, junk.uid);
          bench = benchTowers(run);
        }
        let rerolls = 0;
        while (run.gold >= 60 && rerolls < 6 && !run.shop.some((id) => id && cost(id) >= 8)) {
          rerollShop(g);
          rerolls++;
        }
        const SUPPORT = new Set(['etendard', 'marque', 'idole', 'condensateur']);
        let bought = true;
        while (bought) {
          bought = false;
          const supportOwned = run.towers.filter((t) => SUPPORT.has(t.defId)).length;
          const slots = run.shop
            .map((id, i) => ({ id, i }))
            .filter((x): x is { id: string; i: number } => !!x.id)
            .sort((a, b) => cost(b.id) - cost(a.id));
          for (const s of slots) {
            if (SUPPORT.has(s.id) && supportOwned >= 1) continue;
            if (buyTower(g, s.i)) {
              bought = true;
              break;
            }
          }
        }
        const toPlace = benchTowers(run).sort((a, b) => cost(b.defId) - cost(a.defId));
        for (const t of toPlace) {
          for (const s of spots) if (placeTower(g, t.uid, s)) break;
        }
        startWave(g);
        let steps = 0;
        while ((c.phase as string) === 'wave' && steps < 180 * 60) {
          updateCombat(g, 1 / 60);
          steps++;
        }
        g.events.splice(0);
      }
      report.push({
        c: g.run.combatIndex,
        heart: Math.round(g.run.heartHp),
        deployed: placedTowers(g.run).length,
        gold: g.run.gold,
      });
      if (g.run.heartHp <= 0) {
        report.push('DEFEAT c' + g.run.combatIndex);
        break;
      }
      const rtd = (window as unknown as Record<string, { openRewardFlow: () => void }>).__rtd;
      rtd.openRewardFlow();
      $('btn-next')?.click();
      const cards = [...document.querySelectorAll<HTMLElement>('.augment-card')];
      if (cards.length) {
        const prio = AUG_PRIO_BY_CLASS[g.run.classId] ?? [];
        const rank = (el: HTMLElement) => {
          const i = prio.indexOf(el.dataset.aug ?? '');
          return i < 0 ? 99 : i;
        };
        const best = o.smartAug ? cards.sort((a, b) => rank(a) - rank(b))[0] : cards[0];
        best.click();
      }
      if ((g.screen as string) === 'victory') {
        report.push('VICTORY, kills=' + g.run.stats.kills);
        break;
      }
    }
    return report;
    } finally {
      w.__botRunning = false;
    }
  };
}
