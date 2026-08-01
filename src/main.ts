import './style.css';
import { playSfx, toggleMute } from './audio';
import { CELL } from './const';
import { setupCombat, startWave, updateCombat } from './combat';
import { render } from './render';
import { buyTower, placeTower, rerollShop, sellTower } from './shop';
import {
  applyAugment, benchTowers, buyDeploySlot, createGame, heartMax, pickAugmentOffers,
  placedTowers, towerEffStats,
} from './state';
import {
  hidePopover, hideTooltip, initUI, openDefeat, openRewardFlow, refreshDock, setAscension,
  showPopover, updateHUD,
} from './ui';
import type { Vec } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const g = createGame();
initUI(g, canvas);

// ---------- Entrées souris / clavier ----------

function eventCell(ev: MouseEvent): Vec {
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  return { x: Math.floor(x / CELL), y: Math.floor(y / CELL) };
}

function towerAtCell(cell: Vec): number | null {
  if (!g.run) return null;
  for (const t of g.run.towers) {
    if (t.placed && t.cell && t.cell.x === cell.x && t.cell.y === cell.y) return t.uid;
  }
  return null;
}

canvas.addEventListener('mousemove', (ev) => {
  const cell = eventCell(ev);
  g.ui.hoverCell = cell;
  g.ui.hoverTower = towerAtCell(cell);
});

canvas.addEventListener('mouseleave', () => {
  g.ui.hoverCell = null;
  g.ui.hoverTower = null;
});

canvas.addEventListener('click', (ev) => {
  if (g.screen !== 'combat' || !g.run) return;
  const cell = eventCell(ev);

  // placement depuis la réserve
  if (g.ui.selectedBench != null) {
    const placing = g.run.towers.find((t) => t.uid === g.ui.selectedBench);
    if (placing && placeTower(g, placing.uid, cell)) {
      playSfx('place');
      // enchaîne sur une autre tour identique de la réserve, s'il y en a
      const next = benchTowers(g.run).find((t) => t.defId === placing.defId);
      g.ui.selectedBench = next ? next.uid : null;
      refreshDock();
      return;
    }
  }

  // sélection d'une tour posée
  const uid = towerAtCell(cell);
  if (uid != null) {
    g.ui.selectedBench = null;
    g.ui.selectedTower = uid;
    showPopover(uid);
    refreshDock();
  } else {
    hidePopover();
  }
});

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  g.ui.selectedBench = null;
  hidePopover();
  refreshDock();
});

window.addEventListener('keydown', (ev) => {
  if (g.screen !== 'combat') return;
  if (ev.key === 'Escape') {
    g.ui.selectedBench = null;
    hidePopover();
    refreshDock();
  } else if (ev.key === ' ') {
    ev.preventDefault();
    g.paused = !g.paused;
    updateHUD();
  } else if (ev.key >= '1' && ev.key <= '3') {
    g.speed = Number(ev.key);
    g.paused = false;
    updateHUD();
  } else if (ev.key === 'm' || ev.key === 'M') {
    toggleMute();
    updateHUD();
  } else if ((ev.key === 'r' || ev.key === 'R') && !document.querySelector('.modal-overlay')) {
    (document.getElementById('btn-reroll') as HTMLButtonElement | null)?.click();
  } else if ((ev.key === 'l' || ev.key === 'L') && !document.querySelector('.modal-overlay')) {
    (document.getElementById('btn-lock') as HTMLButtonElement | null)?.click();
  }
});

// ---------- Boucle principale ----------

let last = performance.now();
let hudTimer = 0;

function frame(now: number): void {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (g.screen === 'combat') {
    let sim = dtReal * g.speed;
    while (sim > 1e-6) {
      const step = Math.min(sim, 1 / 60);
      updateCombat(g, step);
      sim -= step;
    }

    // événements de jeu
    for (const ev of g.events.splice(0)) {
      if (ev.type === 'waveCleared') {
        refreshDock();
        updateHUD();
      } else if (ev.type === 'combatWon') {
        refreshDock();
        hidePopover();
        hideTooltip();
        setTimeout(() => openRewardFlow(), 650);
      } else if (ev.type === 'runLost') {
        hidePopover();
        hideTooltip();
        setTimeout(() => openDefeat(), 900);
      }
    }

    hudTimer += dtReal;
    if (hudTimer >= 0.15) {
      hudTimer = 0;
      updateHUD();
    }
    render(g, ctx);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ---------- Hooks de test automatisé (console / outillage dev) ----------
// Permet de piloter une partie sans interface : placement, vagues, simulation pas à pas.
(window as unknown as Record<string, unknown>).__rtd = {
  g,
  updateCombat,
  setupCombat,
  startWave,
  placeTower,
  buyTower,
  sellTower,
  rerollShop,
  applyAugment,
  pickAugmentOffers,
  towerEffStats,
  benchTowers,
  placedTowers,
  heartMax,
  buyDeploySlot,
  refreshDock,
  updateHUD,
  openRewardFlow,
  openDefeat,
  setAscension,
};

if (import.meta.env.DEV) {
  import('./devbot').then((m) => m.installDevBot(g));
}
