// Bot de playtest automatisé — chargé uniquement en mode dev (voir main.ts).
// Usage console : __bot({ classIdx: 0, cheatGold: 0, deployAt: 80, smartAug: true })
// Joue une run complète en headless et renvoie un rapport par combat.
import { startWave, updateCombat } from './combat';
import { TOWERS } from './data/towers';
import { buyTower, placeTower, rerollShop, sellTower, upgradeTower } from './shop';
import { benchTowers, buyDeploySlot, placedTowers } from './state';
import type { CombatState, Game } from './types';

interface BotOpts {
  classIdx?: number; // 0 = Ironclad, 1 = Silencieuse, 2 = Defect
  cheatGold?: number;
  deployAt?: number; // acheter un slot de déploiement dès que l'or dépasse ce seuil
  smartAug?: boolean;
  ascension?: number;
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
  watcher: [
    'ferveur', 'poigne', 'colere_prolongee', 'illumination', 'pacte_sanglant', 'veteran',
    'apprentissage', 'troisieme_oeil', 'calme_profond', 'marche_vide', 'reflexes',
    'critique', 'longue_vue', 'percant', 'pressentiment',
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

/**
 * Benchmark du rendu : état de stress synthétique (60 ennemis, 50 projectiles)
 * puis 300 rendus chronométrés. Usage console : __benchRender()
 */
function installBench(g: Game): void {
  (window as unknown as Record<string, unknown>).__benchRender = () => {
    const w = window as unknown as Record<string, { g: Game; setupCombat: (g: Game) => void; render: () => void }>;
    const rtd = w.__rtd;
    const $ = (id: string) => document.getElementById(id);
    if ($('btn-play')) $('btn-play')!.click();
    else {
      ($('btn-again') as HTMLButtonElement | null)?.click();
      ($('btn-play') as HTMLButtonElement | null)?.click();
    }
    document.querySelectorAll<HTMLButtonElement>('.class-card button')[0]?.click();
    if (!g.run) return 'RESET FAILED';
    g.run.combatIndex = 9;
    rtd.setupCombat(g);
    const bench = benchTowers(g.run).slice(0, 3);
    [{ x: 11, y: 6 }, { x: 13, y: 6 }, { x: 11, y: 8 }].forEach((s, i) => {
      if (bench[i]) placeTower(g, bench[i].uid, s);
    });
    startWave(g);
    g.paused = false;
    for (let i = 0; i < 6 * 60; i++) updateCombat(g, 1 / 60);
    g.paused = true;
    const c = g.combat!;
    const base = [...c.enemies];
    let uid = 900000;
    while (c.enemies.length < 60 && base.length) {
      for (const e of base) {
        if (c.enemies.length >= 60) break;
        const clone = JSON.parse(JSON.stringify(e)) as typeof e;
        clone.uid = uid++;
        clone.dist = Math.max(0, e.dist - (c.enemies.length * 17) % 500);
        c.enemies.push(clone);
      }
    }
    for (let i = 0; i < 50; i++) {
      const tgt = c.enemies[i % c.enemies.length];
      c.projectiles.push({
        x: 300 + (i * 37) % 500, y: 200 + (i * 53) % 300, speed: 420,
        targetUid: tgt.uid, lastPos: { ...tgt.pos }, damage: 10, crit: false,
        splash: 0, effects: { armorPierce: 0 }, color: '#ff9d6b', size: 3,
        chain: i % 3 === 0 ? { jumps: 1, range: 95, decay: 0.65 } : undefined,
      });
    }
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) rtd.render();
    return { enemies: c.enemies.length, proj: c.projectiles.length, msParRendu: Math.round(((performance.now() - t0) / 300) * 1000) / 1000 };
  };
}

export function installDevBot(g: Game): void {
  installBench(g);
  (window as unknown as Record<string, unknown>).__bot = (opts: BotOpts = {}) => {
    const o = { classIdx: 0, cheatGold: 0, deployAt: 80, smartAug: true, ascension: 0, ...opts };
    const $ = (id: string) => document.getElementById(id);
    const w = window as unknown as Record<string, unknown>;
    w.__botRunning = true; // les runs du bot ne polluent pas l'archive localStorage
    try {
    const rtdApi = w.__rtd as { setAscension?: (n: number) => void };
    rtdApi.setAscension?.(o.ascension);

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
        // améliore la tour la plus meurtrière quand la cagnotte le permet
        while (run.gold >= 120) {
          const best = placedTowers(run).filter((t) => t.level < 3).sort((a, b) => b.kills - a.kills)[0];
          if (!best || !upgradeTower(g, best.uid)) break;
        }
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
        const SUPPORT = new Set(['etendard', 'marque', 'idole', 'condensateur', 'lotus']);
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
      // nœud à choix (carte StS) : le bot joue la ligne standard
      $('node-combat')?.click();
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
