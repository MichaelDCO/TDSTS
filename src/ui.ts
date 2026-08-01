import { isMuted, playSfx, toggleMute } from './audio';
import { playMusic, stopMusic } from './music';
import { CELL, CLASS_COLORS, CLASS_NAMES, RARITY_COLORS, RARITY_NAMES, TOTAL_COMBATS } from './const';
import { setupCombat, startWave, upcomingPortals } from './combat';
import { AUGMENTS } from './data/augments';
import { CLASSES } from './data/classes';
import { COMBAT_PLAN } from './data/combats';
import { ENEMIES } from './data/enemies';
import { TOWERS } from './data/towers';
import { buyTower, pickupTower, rerollShop, sellTower, upgradeTower } from './shop';
import {
  ASCENSION_DESCS, MAX_DEPLOY_BONUS, MAX_TOWER_LEVEL, applyAugment, benchTowers, buyDeploySlot,
  deployCapFor, deploySlotCost, heartMax, interestFor, newRun, pickAugmentOffers, placedTowers,
  towerEffStats, upgradeCost,
} from './state';

// Écran tactile : pas de tooltips au survol (elles resteraient collées)
const IS_COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
import type { AugmentDef, ClassId, Game, TowerDef, TowerInst } from './types';

// ---------- Références DOM ----------
const $ = (id: string) => document.getElementById(id)!;
let g: Game;
let canvas: HTMLCanvasElement;

export function initUI(game: Game, cv: HTMLCanvasElement): void {
  g = game;
  canvas = cv;
  $('btn-reroll').addEventListener('click', () => {
    if (rerollShop(g)) {
      playSfx('reroll');
      refreshDock();
    }
  });
  $('btn-wave').addEventListener('click', () => {
    if (g.combat?.phase === 'prep') {
      startWave(g);
      hidePopover();
      refreshDock();
    }
  });
  $('btn-deploy').addEventListener('click', () => {
    if (g.run && buyDeploySlot(g.run)) {
      playSfx('buy');
      refreshDock();
      updateHUD();
    }
  });
  $('btn-lock').addEventListener('click', () => {
    if (!g.run) return;
    g.run.shopLocked = !g.run.shopLocked;
    playSfx('lock');
    refreshDock();
  });
  buildSpeedButtons();
  showScreen();
}

// ---------- Écrans ----------

/** Adapte la musique 8 bits à l'écran courant (silence sur les écrans de fin). */
export function syncMusic(): void {
  if ((window as unknown as Record<string, unknown>).__botRunning) return;
  if (isMuted()) {
    stopMusic();
    return;
  }
  if (g.screen === 'combat') playMusic(g.run && g.run.combatIndex >= 10 ? 'boss' : 'combat');
  else if (g.screen === 'menu' || g.screen === 'class') playMusic('menu');
  else stopMusic();
}

export function showScreen(): void {
  const inCombat = g.screen === 'combat';
  $('topbar').classList.toggle('hidden', !inCombat);
  $('gamewrap').classList.toggle('hidden', !inCombat);
  $('dock').classList.toggle('hidden', !inCombat);
  hidePopover();
  hideTooltip();
  syncMusic();
  if (g.screen === 'menu') renderMenu();
  else if (g.screen === 'class') renderClassSelect();
  else if (g.screen === 'victory') renderEndScreen(true);
  else if (g.screen === 'defeat') renderEndScreen(false);
  else closeModal();
  if (inCombat) {
    refreshDock();
    updateHUD();
  }
}

function modal(html: string, cls = ''): HTMLElement {
  const root = $('modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal ${cls}">${html}</div></div>`;
  return root.querySelector('.modal')!;
}

function closeModal(): void {
  $('modal-root').innerHTML = '';
}

// ---------- Archive locale des runs ----------

interface RunRecord {
  v: number; // 1 = victoire
  cls: ClassId;
  c: number; // combat atteint
  kills: number;
  date: number;
  a?: number; // niveau d'Ascension
}

export function maxAscension(): number {
  try {
    return Math.max(0, Math.min(5, Number(localStorage.getItem('rtd-ascension') ?? '0') || 0));
  } catch {
    return 0;
  }
}

let chosenAscension = -1; // -1 = pas encore initialisé (défaut : max débloqué)
let pendingSeed: number | null = null; // graine préremplie (« Rejouer la graine »)

export function setAscension(n: number): void {
  chosenAscension = Math.max(0, Math.min(maxAscension(), n));
}

/** Convertit l'entrée graine (nombre ou texte) en seed 32 bits, ou undefined si vide. */
function parseSeed(txt: string): number | undefined {
  const s = txt.trim();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s) >>> 0;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function loadRecords(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem('rtd-records') ?? '[]') as RunRecord[];
  } catch {
    return [];
  }
}

function saveRunRecord(victory: boolean): void {
  const run = g.run;
  if (!run || run.recorded) return;
  run.recorded = true;
  if ((window as unknown as Record<string, unknown>).__botRunning) return; // les runs du bot ne comptent pas
  const recs = loadRecords();
  recs.push({ v: victory ? 1 : 0, cls: run.classId, c: run.combatIndex, kills: run.stats.kills, date: Date.now(), a: run.ascension });
  localStorage.setItem('rtd-records', JSON.stringify(recs.slice(-30)));
  // une victoire débloque le niveau d'Ascension suivant
  if (victory) {
    const next = Math.min(5, Math.max(maxAscension(), run.ascension + 1));
    localStorage.setItem('rtd-ascension', String(next));
  }
}

function recordsSummaryHtml(): string {
  const recs = loadRecords();
  if (!recs.length) return '';
  const wins = recs.filter((r) => r.v).length;
  const best = recs.reduce((a, b) => (b.v > a.v || (b.v === a.v && b.c > a.c) ? b : a));
  const ascTxt = best.a && best.a > 0 ? ` 🔥A${best.a}` : '';
  const bestTxt = best.v
    ? `victoire avec ${CLASSES[best.cls].name}${ascTxt}`
    : `combat ${best.c} atteint (${CLASSES[best.cls].name}${ascTxt})`;
  return `<p class="records-line">📜 ${recs.length} run${recs.length > 1 ? 's' : ''} — ${wins} victoire${wins > 1 ? 's' : ''} • Meilleure : ${bestTxt}</p>`;
}

function renderMenu(): void {
  const m = modal(`
    <h1 class="title">Rachidus <span class="accent">TD</span></h1>
    <p class="subtitle">Défendez le Cœur de la Flèche contre la corruption</p>
    ${recordsSummaryHtml()}
    <div class="menu-help">
      <p>🏰 Un <b>tower defense roguelite</b> : 10 combats, des portails qui s'ouvrent en pleine bataille,
      une boutique aléatoire à relancer et des augments à choisir entre les combats.</p>
      <ul>
        <li>🛒 Achetez des tours en boutique (elle se renouvelle à chaque vague)</li>
        <li>🧱 Posez-les hors des fissures — les ennemis suivent les fissures jusqu'au Cœur</li>
        <li>⚠️ Surveillez les portails : de nouveaux s'ouvrent en cours de combat</li>
        <li>📈 Gardez de l'or : +1 d'intérêt par tranche de 10 à chaque vague (max 5)</li>
        <li>💎 Vos tours sont conservées de combat en combat — redéployez-les à chaque carte</li>
        <li>⌨️ Raccourcis : <b>Espace</b> pause • <b>1/2/3</b> vitesse • <b>R</b> relancer • <b>L</b> verrouiller • <b>M</b> muet</li>
      </ul>
    </div>
    <div class="btn-row">
      <button class="btn primary big" id="btn-play">⚔️ Nouvelle run</button>
      <button class="btn big" id="btn-bestiary">📖 Bestiaire</button>
    </div>
  `, 'menu-modal');
  m.querySelector('#btn-play')!.addEventListener('click', () => {
    g.screen = 'class';
    showScreen();
  });
  m.querySelector('#btn-bestiary')!.addEventListener('click', renderBestiary);
}

/** Compendium des ennemis : stats de base (combat 1) et comportements. */
function renderBestiary(): void {
  const groups: { title: string; kind: string }[] = [
    { title: 'Créatures', kind: 'normal' },
    { title: 'Élites', kind: 'elite' },
    { title: 'Boss', kind: 'boss' },
  ];
  const sections = groups.map(({ title, kind }) => {
    const rows = Object.values(ENEMIES)
      .filter((e) => e.kind === kind)
      .map((e) => `
        <div class="bst-card ${kind}">
          <span class="bst-dot" style="background:${e.color}"></span>
          <div class="bst-body">
            <div class="bst-name">${e.name}</div>
            <div class="bst-stats">❤️${e.hp} • 👟${e.speed} • ${e.armor > 0 ? `🛡️${e.armor} • ` : ''}💰${e.bounty} • 💔${e.heartDmg}</div>
            ${e.desc ? `<div class="bst-desc">${e.desc}</div>` : ''}
          </div>
        </div>`)
      .join('');
    return `<h3 class="bst-title">${title}</h3><div class="bst-grid">${rows}</div>`;
  }).join('');
  const m = modal(`
    <h1>📖 Bestiaire de la Flèche</h1>
    <p class="subtitle">PV de base au combat 1 — ils grimpent à chaque combat et chaque vague</p>
    <div class="bst-wrap">${sections}</div>
    <button class="btn big" id="btn-bst-back">↩️ Retour</button>
  `, 'bestiary-modal');
  m.querySelector('#btn-bst-back')!.addEventListener('click', renderMenu);
}

function renderClassSelect(): void {
  const maxAsc = maxAscension();
  if (chosenAscension < 0) chosenAscension = maxAsc;
  chosenAscension = Math.min(chosenAscension, maxAsc);
  const ascHtml = maxAsc > 0
    ? `<div class="asc-row">🔥 Ascension :
        ${Array.from({ length: maxAsc + 1 }, (_, i) =>
    `<button class="btn tiny ${i === chosenAscension ? 'active' : ''}" data-asc="${i}">${i}</button>`).join('')}
      </div>
      ${chosenAscension > 0
    ? `<p class="asc-desc">${ASCENSION_DESCS.slice(1, chosenAscension + 1).join(' • ')}</p>`
    : '<p class="asc-desc dim">Difficulté normale</p>'}`
    : '';
  const cards = (Object.keys(CLASSES) as ClassId[]).map((id) => {
    const c = CLASSES[id];
    const towers = c.startingTowers.map((tid) => TOWERS[tid].glyph).join(' ');
    return `
      <div class="class-card" data-class="${id}" style="--cc:${c.color}">
        <div class="class-glyph">${c.glyph}</div>
        <h2>${c.name}</h2>
        <p class="class-title">${c.title}</p>
        <p class="class-desc">${c.desc}</p>
        <p class="class-passive"><b>${c.passiveName}</b> — ${c.passiveDesc}</p>
        <p class="class-towers">Tours de départ : ${towers}</p>
        <button class="btn primary">Choisir</button>
      </div>`;
  }).join('');
  const seedHtml = `<div class="seed-row">
    <input id="seed-input" type="text" placeholder="🌱 Graine (optionnel — même graine, même run)"
      value="${pendingSeed !== null ? pendingSeed : ''}" spellcheck="false">
  </div>`;
  const m = modal(`<h1>Choisissez votre champion</h1>${ascHtml}<div class="class-row">${cards}</div>${seedHtml}`, 'class-modal');
  m.querySelectorAll<HTMLButtonElement>('.asc-row button').forEach((b) => {
    b.addEventListener('click', () => {
      chosenAscension = Number(b.dataset.asc);
      const keep = (m.querySelector('#seed-input') as HTMLInputElement | null)?.value ?? '';
      pendingSeed = parseSeed(keep) ?? null;
      renderClassSelect();
    });
  });
  m.querySelectorAll<HTMLElement>('.class-card').forEach((el) => {
    el.querySelector('button')!.addEventListener('click', () => {
      const cls = el.dataset.class as ClassId;
      const seedTxt = (m.querySelector('#seed-input') as HTMLInputElement | null)?.value ?? '';
      pendingSeed = null;
      newRun(g, cls, Math.max(0, chosenAscension), parseSeed(seedTxt));
      setupCombat(g);
      g.screen = 'combat';
      showScreen();
      toastCombatIntro();
    });
  });
}

function toastCombatIntro(): void {
  const run = g.run!;
  const def = COMBAT_PLAN[run.combatIndex - 1];
  const el = document.createElement('div');
  el.className = 'combat-toast';
  el.innerHTML = `<b>Combat ${run.combatIndex}/${TOTAL_COMBATS}</b><span>${def.name}</span>`;
  $('gamewrap').appendChild(el);
  setTimeout(() => el.classList.add('gone'), 1900);
  setTimeout(() => el.remove(), 2500);
}

// ---------- Fin de combat : récompense → augment ----------

export function openRewardFlow(): void {
  const run = g.run!;
  const def = COMBAT_PLAN[run.combatIndex - 1];
  const isLast = run.combatIndex >= TOTAL_COMBATS;
  const goldReward = 10 + 2 * run.combatIndex + (def.kind === 'elite' ? 10 : 0);
  const heal = Math.min(run.mods.healPerCombat, heartMax(run) - run.heartHp);
  run.gold += goldReward;
  run.stats.goldEarned += goldReward;
  run.heartHp += heal;

  if (isLast) {
    playSfx('victory');
    g.screen = 'victory';
    showScreen();
    return;
  }

  const top = placedTowers(run)
    .filter((t) => t.combatDmg > 0)
    .sort((a, b) => b.combatDmg - a.combatDmg)
    .slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const topHtml = top.length
    ? `<div class="top-towers"><span class="dim">Meilleures tours (dégâts directs)</span>${top
      .map((t, i) => {
        const def = TOWERS[t.defId];
        return `<span class="best-tower">${medals[i]} ${def.glyph} ${def.name} — <b>${Math.round(t.combatDmg)}</b></span>`;
      })
      .join('')}</div>`
    : '';

  const m = modal(`
    <h1>✨ Combat remporté !</h1>
    <p class="reward-line">💰 Butin : <b>+${goldReward} or</b></p>
    <p class="reward-line">❤️ Le Cœur récupère <b>${heal} PV</b></p>
    ${topHtml}
    <button class="btn primary big" id="btn-next">Choisir un augment</button>
  `);
  m.querySelector('#btn-next')!.addEventListener('click', () => openAugmentChoice(def.kind === 'elite'));
}

function augmentCard(a: AugmentDef): string {
  const color = CLASS_COLORS[a.classId];
  return `
    <div class="augment-card ${a.rarity}" data-aug="${a.id}" style="--cc:${color}">
      <div class="aug-glyph">${a.glyph}</div>
      <div class="aug-name">${a.name}</div>
      <div class="aug-class" style="color:${color}">${CLASS_NAMES[a.classId]}${a.rarity === 'rare' ? ' • Rare' : ''}</div>
      <div class="aug-desc">${a.desc}</div>
    </div>`;
}

function openAugmentChoice(afterElite: boolean): void {
  const run = g.run!;
  let offers = pickAugmentOffers(run, 3, afterElite);
  let rerollsLeft = run.mods.augRerolls;

  const draw = () => {
    const m = modal(`
      <h1>Choisissez un augment</h1>
      <p class="subtitle">Général ou lié à votre classe — il s'applique pour tout le reste de la run</p>
      <div class="augment-row">${offers.map(augmentCard).join('')}</div>
      <button class="btn small" id="btn-aug-reroll" ${rerollsLeft <= 0 ? 'disabled' : ''}>🎲 Relancer (${rerollsLeft} gratuite${rerollsLeft > 1 ? 's' : ''})</button>
    `, 'augment-modal');
    m.querySelectorAll<HTMLElement>('.augment-card').forEach((el) => {
      el.addEventListener('click', () => {
        playSfx('augment');
        applyAugment(run, el.dataset.aug!);
        run.combatIndex++;
        setupCombat(g);
        closeModal();
        showScreen();
        toastCombatIntro();
      });
    });
    m.querySelector('#btn-aug-reroll')!.addEventListener('click', () => {
      if (rerollsLeft <= 0) return;
      rerollsLeft--;
      offers = pickAugmentOffers(run, 3, afterElite);
      draw();
    });
  };
  draw();
}

function renderEndScreen(victory: boolean): void {
  if (!g.run) {
    g.screen = 'menu';
    renderMenu();
    return;
  }
  saveRunRecord(victory);
  const run = g.run;
  const s = run.stats;
  const m = modal(`
    <h1>${victory ? '👑 VICTOIRE !' : '💀 Le Cœur a été détruit…'}</h1>
    <p class="subtitle">${victory
      ? `Le Roi des Slimes n’est plus qu’une flaque. La Flèche est sauvée${run.ascension > 0 ? ` — en Ascension ${run.ascension} !` : '.'}${run.ascension < 5 && maxAscension() <= run.ascension + 1 ? ' 🔥 Ascension suivante débloquée !' : ''}`
      : `Vous avez tenu jusqu'au combat ${run.combatIndex}${run.ascension > 0 ? ` en Ascension ${run.ascension}` : ''} (${COMBAT_PLAN[run.combatIndex - 1].name}).`}</p>
    <div class="stats-grid">
      <div><b>${s.kills}</b><span>ennemis éliminés</span></div>
      <div><b>${s.wavesCleared}</b><span>vagues repoussées</span></div>
      <div><b>${Math.round(s.dmgDealt)}</b><span>dégâts infligés</span></div>
      <div><b>${s.goldEarned}</b><span>or amassé</span></div>
      <div><b>${run.towers.length}</b><span>tours possédées</span></div>
      <div><b>${run.augments.length}</b><span>augments choisis</span></div>
    </div>
    <p class="seed-line">🌱 Graine de la run : <b>${run.seed}</b></p>
    <div class="btn-row">
      <button class="btn primary big" id="btn-again">⚔️ Nouvelle run</button>
      <button class="btn big" id="btn-replay-seed" title="Même boutique, mêmes vagues, mêmes augments">🌱 Rejouer la graine</button>
      <button class="btn big" id="btn-menu">Menu</button>
    </div>
  `);
  m.querySelector('#btn-again')!.addEventListener('click', () => {
    g.screen = 'class';
    showScreen();
  });
  m.querySelector('#btn-replay-seed')!.addEventListener('click', () => {
    pendingSeed = run.seed;
    g.screen = 'class';
    showScreen();
  });
  m.querySelector('#btn-menu')!.addEventListener('click', () => {
    g.screen = 'menu';
    showScreen();
  });
}

export function openDefeat(): void {
  playSfx('defeat');
  g.screen = 'defeat';
  showScreen();
}

// ---------- HUD ----------

function buildSpeedButtons(): void {
  const el = $('tb-speed');
  el.innerHTML = `
    <button class="btn tiny" data-sp="0">⏸</button>
    <button class="btn tiny" data-sp="1">×1</button>
    <button class="btn tiny" data-sp="2">×2</button>
    <button class="btn tiny" data-sp="3">×3</button>
    <button class="btn tiny" id="btn-mute" title="Son (M)"></button>`;
  el.querySelectorAll<HTMLButtonElement>('button[data-sp]').forEach((b) => {
    b.addEventListener('click', () => {
      const sp = Number(b.dataset.sp);
      if (sp === 0) g.paused = !g.paused;
      else {
        g.speed = sp;
        g.paused = false;
      }
      updateHUD();
    });
  });
  $('btn-mute').addEventListener('click', () => {
    toggleMute();
    syncMusic();
    updateHUD();
  });
}

export function updateHUD(): void {
  if (!g.run || g.screen !== 'combat') return;
  const run = g.run;
  const c = g.combat!;
  const cls = CLASSES[run.classId];
  $('tb-class').innerHTML = `<span class="chip" style="--cc:${cls.color}">${cls.glyph} ${cls.name}</span>`;
  const hm = heartMax(run);
  const low = run.heartHp <= hm * 0.35;
  $('tb-heart').innerHTML = `<span class="stat ${low ? 'danger' : ''}">💙 ${Math.max(0, Math.ceil(run.heartHp))}/${hm}</span>`;
  $('tb-gold').innerHTML = `<span class="stat gold">💰 ${run.gold}</span><span class="interest" title="Intérêts par vague">📈 +${interestFor(run)}</span>`;
  const waveNum = Math.min(c.waveIndex + 1, c.waves.length);
  $('tb-progress').innerHTML = `
    <span class="stat">${c.def.kind === 'elite' ? '👹 ' : c.def.kind === 'boss' ? '👑 ' : ''}Combat ${run.combatIndex}/${TOTAL_COMBATS}</span>
    ${run.ascension > 0 ? `<span class="stat asc" title="Ascension ${run.ascension}">🔥A${run.ascension}</span>` : ''}
    <span class="stat dim">${c.def.name}</span>
    <span class="stat">🌊 Vague ${waveNum}/${c.waves.length}</span>`;
  $('tb-speed').querySelectorAll<HTMLButtonElement>('button[data-sp]').forEach((b) => {
    const sp = Number(b.dataset.sp);
    b.classList.toggle('active', sp === 0 ? g.paused : !g.paused && g.speed === sp);
  });
  $('btn-mute').textContent = isMuted() ? '🔇' : '🔊';
}

// ---------- Dock : boutique / réserve / vague ----------

function towerStatsHtml(def: TowerDef, inst?: TowerInst): string {
  const run = g.run!;
  const fake = (inst ?? { defId: def.id, buffMult: 1 }) as TowerInst;
  const s = towerEffStats(run, fake);
  const lines: string[] = [];
  if (def.kind !== 'aura') {
    if (s.damage > 0) lines.push(`⚔️ ${Math.round(s.damage * 10) / 10} dégâts`);
    lines.push(`⏱️ ${(1 / s.cooldown).toFixed(2)} att/s`);
    if (s.damage > 0) lines.push(`📊 ${(s.damage / s.cooldown).toFixed(1)} DPS${(s.targets ?? 1) > 1 ? ` ×${s.targets} cibles` : ''}${def.kind === 'pulse' ? ' (zone)' : ''}`);
  }
  lines.push(`🎯 portée ${Math.round(s.range)}`);
  if (s.critChance > 0) lines.push(`💥 ${Math.round(s.critChance * 100)} % crit`);
  if (def.splash) lines.push(`💣 zone ${def.splash}px`);
  if (def.ignoreArmor) lines.push('🔮 ignore l’armure');
  return lines.map((l) => `<div>${l}</div>`).join('');
}

function towerTooltipHtml(def: TowerDef, inst?: TowerInst): string {
  return `
    <div class="tt-head" style="color:${CLASS_COLORS[def.classId]}">${def.glyph} <b>${def.name}</b></div>
    <div class="tt-sub" style="color:${RARITY_COLORS[def.rarity]}">${RARITY_NAMES[def.rarity]} • ${CLASS_NAMES[def.classId]} • ${def.cost} or</div>
    <div class="tt-stats">${towerStatsHtml(def, inst)}</div>
    <div class="tt-desc">${def.desc}</div>`;
}

export function refreshDock(): void {
  if (!g.run || !g.combat || g.screen !== 'combat') return;
  hideTooltip(); // les cartes se reconstruisent : jamais de tooltip orpheline
  const run = g.run;
  const c = g.combat;
  const prep = c.phase === 'prep';

  // boutique
  const shopEl = $('shop-cards');
  shopEl.innerHTML = run.shop.map((defId, i) => {
    if (!defId) return `<div class="shop-card empty"></div>`;
    const def = TOWERS[defId];
    const afford = run.gold >= def.cost && prep;
    return `
      <div class="shop-card ${afford ? '' : 'disabled'}" data-slot="${i}" style="--rc:${RARITY_COLORS[def.rarity]};--cc:${CLASS_COLORS[def.classId]}">
        <div class="sc-glyph">${def.glyph}</div>
        <div class="sc-name">${def.name}</div>
        <div class="sc-cost">💰${def.cost}</div>
      </div>`;
  }).join('');
  shopEl.querySelectorAll<HTMLElement>('.shop-card[data-slot]').forEach((el) => {
    const slot = Number(el.dataset.slot);
    const defId = run.shop[slot];
    if (!defId) return;
    el.addEventListener('click', () => {
      if (buyTower(g, slot)) {
        playSfx('buy');
        refreshDock();
        hideTooltip();
      }
    });
    if (!IS_COARSE) {
      el.addEventListener('mousemove', (ev) => showTooltip(towerTooltipHtml(TOWERS[defId]), ev));
      el.addEventListener('mouseleave', hideTooltip);
    }
  });

  const rerollBtn = $('btn-reroll') as HTMLButtonElement;
  rerollBtn.textContent = `🎲 Relancer (${run.mods.rerollCost} or)`;
  rerollBtn.disabled = !prep || run.gold < run.mods.rerollCost;
  const lockBtn = $('btn-lock') as HTMLButtonElement;
  lockBtn.textContent = run.shopLocked ? '🔒 Verrouillée' : '🔓 Verrouiller';
  lockBtn.classList.toggle('locked', run.shopLocked);

  // réserve
  const bench = benchTowers(run);
  const deployed = run.towers.length - bench.length;
  const cap = deployCapFor(run);
  $('bench-title').innerHTML = `Réserve <span class="${deployed >= cap ? 'cap-full' : 'cap-ok'}">— en jeu ${deployed}/${cap}</span>`;
  const deployBtn = $('btn-deploy') as HTMLButtonElement;
  if (run.deployBonus >= MAX_DEPLOY_BONUS) {
    deployBtn.textContent = '⛺ Déploiement max';
    deployBtn.disabled = true;
  } else {
    deployBtn.textContent = `⛺ +1 déploiement (${deploySlotCost(run)} or)`;
    deployBtn.disabled = run.gold < deploySlotCost(run);
  }
  const benchEl = $('bench-cards');
  benchEl.innerHTML = bench.length
    ? bench.map((t) => {
      const def = TOWERS[t.defId];
      const sel = g.ui.selectedBench === t.uid;
      return `<div class="bench-card ${sel ? 'selected' : ''}" data-uid="${t.uid}" style="--rc:${RARITY_COLORS[def.rarity]}">
        <div class="sc-glyph">${def.glyph}</div>
      </div>`;
    }).join('')
    : `<div class="bench-hint">Achetez des tours puis cliquez-les pour les poser</div>`;
  benchEl.querySelectorAll<HTMLElement>('.bench-card').forEach((el) => {
    const uid = Number(el.dataset.uid);
    const t = run.towers.find((x) => x.uid === uid)!;
    el.addEventListener('click', () => {
      g.ui.selectedBench = g.ui.selectedBench === uid ? null : uid;
      g.ui.selectedTower = null;
      hidePopover();
      refreshDock();
    });
    if (!IS_COARSE) {
      el.addEventListener('mousemove', (ev) => showTooltip(towerTooltipHtml(TOWERS[t.defId], t), ev));
      el.addEventListener('mouseleave', hideTooltip);
    }
  });

  // panneau vague
  const waveBtn = $('btn-wave') as HTMLButtonElement;
  const waveNum = c.waveIndex + 1;
  if (prep) {
    waveBtn.disabled = false;
    waveBtn.textContent = `⚔️ Lancer la vague ${waveNum}/${c.waves.length}`;
  } else {
    waveBtn.disabled = true;
    waveBtn.textContent = c.phase === 'wave' ? '🌊 Vague en cours…' : '…';
  }
  const warn = upcomingPortals(c);
  const warnHtml = prep && warn.length
    ? `<div class="portal-warn">⚠️ ${warn.length > 1 ? `${warn.length} nouveaux portails s'ouvriront` : 'Un nouveau portail s’ouvrira'} après cette vague !</div>`
    : '';
  $('wave-info').innerHTML = prep
    ? warnHtml + wavePreviewHtml()
    : `<span class="dim">Vous pouvez encore poser des tours de la réserve !</span>`;
}

/** Composition de la prochaine vague, en pastilles colorées par type d'ennemi. */
function waveChips(waveIdx: number): string {
  const c = g.combat!;
  const wave = c.waves[waveIdx];
  if (!wave) return '';
  const counts = new Map<string, number>();
  for (const s of wave.spawns) counts.set(s.enemyId, (counts.get(s.enemyId) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => {
      const def = ENEMIES[id];
      const special = def.kind !== 'normal' ? ` ${def.kind}` : '';
      return `<span class="wp-chip${special}" title="${def.name}${def.desc ? ' — ' + def.desc : ''}">
        <i style="background:${def.color}"></i>${def.kind === 'boss' ? '👑' : def.kind === 'elite' ? '👹' : ''}×${n}</span>`;
    })
    .join('');
}

function wavePreviewHtml(): string {
  const c = g.combat!;
  const run = g.run!;
  const chips = waveChips(c.waveIndex);
  if (!chips) return '';
  let html = `<div class="wave-preview"><span class="wp-label">En approche :</span>${chips}</div>`;
  // Divination (Watcher) : révèle aussi la vague suivante
  if (CLASSES[run.classId].scryWaves >= 1) {
    const next = waveChips(c.waveIndex + 1);
    if (next) html += `<div class="wave-preview scry"><span class="wp-label">👁️ Puis :</span>${next}</div>`;
  }
  return html;
}

// ---------- Popover de tour posée ----------

export function showPopover(uid: number): void {
  const run = g.run!;
  const t = run.towers.find((x) => x.uid === uid);
  if (!t || !t.cell) return;
  const def = TOWERS[t.defId];
  const prep = g.combat?.phase === 'prep';
  const pop = $('tower-popover');
  pop.classList.remove('hidden');
  const stars = '⭐'.repeat(t.level);
  const canUp = t.level < MAX_TOWER_LEVEL;
  const upCost = canUp ? upgradeCost(t) : 0;
  const sellBack = def.cost + Math.floor(((t.level >= 2 ? def.cost * 3 : 0) + (t.level >= 3 ? def.cost * 5 : 0)) / 2);
  pop.innerHTML = `
    <div class="pop-stars">${stars}</div>
    ${towerTooltipHtml(def, t)}
    <div class="tt-kills">☠️ ${t.kills} éliminations${t.buffMult > 1 ? ` • 🚩 +${Math.round((t.buffMult - 1) * 100)} % dégâts` : ''}</div>
    <div class="btn-row">
      <button class="btn small primary" id="pop-upgrade" ${prep && canUp && run.gold >= upCost ? '' : 'disabled'}>
        ${canUp ? `⭐ Améliorer (${upCost} or)` : '⭐ Niveau max'}</button>
    </div>
    <div class="btn-row">
      <button class="btn small" id="pop-pickup" ${prep ? '' : 'disabled'}>↩️ Reprendre</button>
      <button class="btn small danger" id="pop-sell" ${prep ? '' : 'disabled'}>💰 Vendre (+${sellBack})</button>
    </div>`;
  const scale = canvas.clientWidth / canvas.width;
  const px = (t.cell.x + 1) * CELL * scale + 8;
  const py = t.cell.y * CELL * scale;
  pop.style.left = `${Math.min(px, canvas.clientWidth - 240)}px`;
  pop.style.top = `${Math.min(py, canvas.clientHeight - 220)}px`;
  pop.querySelector('#pop-upgrade')!.addEventListener('click', () => {
    if (upgradeTower(g, uid)) {
      playSfx('buy');
      showPopover(uid); // rafraîchit stats et étoiles
      refreshDock();
      updateHUD();
    }
  });
  pop.querySelector('#pop-pickup')!.addEventListener('click', () => {
    if (pickupTower(g, uid)) {
      hidePopover();
      refreshDock();
    }
  });
  pop.querySelector('#pop-sell')!.addEventListener('click', () => {
    if (sellTower(g, uid)) {
      playSfx('sell');
      hidePopover();
      refreshDock();
    }
  });
}

export function hidePopover(): void {
  $('tower-popover').classList.add('hidden');
  if (g) g.ui.selectedTower = null;
}

// ---------- Tooltip ----------

export function showTooltip(html: string, ev: MouseEvent): void {
  const tt = $('tooltip');
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  const pad = 14;
  let x = ev.clientX + pad;
  let y = ev.clientY - 10;
  const rect = tt.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 8) x = ev.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
  tt.style.left = `${x}px`;
  tt.style.top = `${Math.max(8, y)}px`;
}

export function hideTooltip(): void {
  $('tooltip').classList.add('hidden');
}
