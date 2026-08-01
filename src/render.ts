import { CELL, CLASS_COLORS, COLS, H, RARITY_COLORS, ROWS, W } from './const';
import { heartPos, towerCenter, upcomingPortals } from './combat';
import { TOWERS } from './data/towers';
import { cellBuildable } from './shop';
import { placedTowers, towerEffStats } from './state';
import type { EnemyInst, Game, PathGeom } from './types';

export function render(g: Game, ctx: CanvasRenderingContext2D): void {
  const shake = g.combat?.shake ?? 0;
  ctx.save();
  if (shake > 0) {
    const mag = 5 * (shake / 0.45);
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }
  drawBackground(ctx, g);
  if (!g.combat || !g.run) {
    ctx.restore();
    return;
  }
  const c = g.combat;

  // 1) chemins : fissures de corruption
  for (const p of c.map.portals) {
    const used = c.def.portalIds.includes(p.id);
    const active = c.activePortals.has(p.id);
    drawPath(ctx, c.paths[p.id], active, used, c.time);
  }

  // 2) portails
  const upcoming = new Set(upcomingPortals(c));
  for (const p of c.map.portals) {
    if (!c.def.portalIds.includes(p.id)) continue;
    const start = c.paths[p.id].pts[0];
    drawPortal(ctx, start.x, start.y, c.activePortals.has(p.id), upcoming.has(p.id), c.time);
  }

  // 3) cœur
  drawHeart(ctx, g, c.time);

  // 4) tours
  for (const t of placedTowers(g.run)) {
    const def = TOWERS[t.defId];
    const pos = towerCenter(t);
    const selected = g.ui.selectedTower === t.uid;
    const hovered = g.ui.hoverTower === t.uid;
    if (selected || hovered) {
      const stats = towerEffStats(g.run, t);
      drawRange(ctx, pos.x, pos.y, stats.range, CLASS_COLORS[def.classId]);
    }
    drawTower(ctx, pos.x, pos.y, def.glyph, CLASS_COLORS[def.classId], RARITY_COLORS[def.rarity], selected, t.buffMult > 1);
  }

  // 5) ennemis
  for (const e of c.enemies) drawEnemy(ctx, e, c.time);

  // 6) projectiles
  for (const p of c.projectiles) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    if (p.chain) {
      // éclair : zigzag scintillant orienté vers la cible
      const dx = p.lastPos.x - p.x;
      const dy = p.lastPos.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const px = -uy;
      const py = ux;
      const len = Math.min(16, d);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (let s = 1; s <= 3; s++) {
        const j = s < 3 ? (Math.random() * 2 - 1) * 4 : 0;
        ctx.lineTo(p.x + ux * (len * s) / 3 + px * j, p.y + uy * (len * s) / 3 + py * j);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 7) particules
  for (const p of c.particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a);
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.maxR ?? 30) * (p.t / p.life), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 8) fantôme de placement
  drawGhost(g, ctx);

  // 9) textes flottants
  for (const f of c.floaters) {
    const a = 1 - f.t / f.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `bold ${Math.round(14 * (f.scale ?? 1))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- Éléments ----------

function drawBackground(ctx: CanvasRenderingContext2D, g: Game): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#171325');
  grad.addColorStop(1, '#0f0c1a');
  ctx.fillStyle = grad;
  // léger débord pour couvrir les bords pendant le screenshake
  ctx.fillRect(-8, -8, W + 16, H + 16);

  // grille discrète
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, H);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(W, y * CELL + 0.5);
  }
  ctx.stroke();
  void g;
}

function tracePath(ctx: CanvasRenderingContext2D, path: PathGeom): void {
  ctx.beginPath();
  ctx.moveTo(path.pts[0].x, path.pts[0].y);
  for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y);
}

function drawPath(ctx: CanvasRenderingContext2D, path: PathGeom, active: boolean, used: boolean, time: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // lit de la fissure
  ctx.strokeStyle = active ? '#2c1a24' : '#1d1626';
  ctx.lineWidth = CELL * 0.72;
  tracePath(ctx, path);
  ctx.stroke();
  // bordure
  ctx.strokeStyle = active ? 'rgba(224,85,110,0.35)' : 'rgba(120,90,160,0.15)';
  ctx.lineWidth = CELL * 0.72;
  ctx.setLineDash([]);
  tracePath(ctx, path);
  ctx.stroke();
  ctx.strokeStyle = active ? '#3a2030' : '#241b30';
  ctx.lineWidth = CELL * 0.6;
  tracePath(ctx, path);
  ctx.stroke();
  // flux d'ichor animé sur les chemins actifs
  if (active) {
    ctx.strokeStyle = 'rgba(224,85,110,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 16]);
    ctx.lineDashOffset = -time * 40;
    tracePath(ctx, path);
    ctx.stroke();
  } else if (used) {
    ctx.strokeStyle = 'rgba(170,120,200,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    tracePath(ctx, path);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, upcoming: boolean, time: number): void {
  ctx.save();
  if (active) {
    const pulse = 1 + Math.sin(time * 3) * 0.08;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 20 * pulse);
    grad.addColorStop(0, '#e0556e');
    grad.addColorStop(0.6, '#7a2050');
    grad.addColorStop(1, 'rgba(60,20,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8aa0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 15, time * 2, time * 2 + Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 10, -time * 2.6, -time * 2.6 + Math.PI);
    ctx.stroke();
  } else if (upcoming) {
    const blink = (Math.sin(time * 5) + 1) / 2;
    ctx.strokeStyle = `rgba(255,170,80,${0.4 + blink * 0.6})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,190,90,${0.6 + blink * 0.4})`;
    ctx.fillText('!', x, y + 6);
  } else {
    ctx.strokeStyle = 'rgba(160,120,190,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const c = g.combat!;
  const { x, y } = heartPos(c);
  const pulse = 1 + Math.sin(time * 2.2) * 0.06;
  ctx.save();
  const grad = ctx.createRadialGradient(x, y, 4, x, y, 34 * pulse);
  grad.addColorStop(0, 'rgba(140,190,255,0.9)');
  grad.addColorStop(0.5, 'rgba(90,130,240,0.35)');
  grad.addColorStop(1, 'rgba(90,130,240,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 36 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // cristal
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const s = 13 * pulse;
  const cg = ctx.createLinearGradient(-s, -s, s, s);
  cg.addColorStop(0, '#b8d8ff');
  cg.addColorStop(0.5, '#5f8ef0');
  cg.addColorStop(1, '#3a55b0');
  ctx.fillStyle = cg;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = '#dceaff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-s, -s, s * 2, s * 2);
  ctx.restore();
}

function drawRange(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color + '18';
  ctx.strokeStyle = color + '66';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D, x: number, y: number, glyph: string,
  classColor: string, rarityColor: string, selected: boolean, buffed: boolean,
): void {
  ctx.save();
  const s = CELL * 0.42;
  // socle
  ctx.fillStyle = '#221c33';
  ctx.strokeStyle = selected ? '#ffffff' : rarityColor;
  ctx.lineWidth = selected ? 2.5 : 2;
  roundRect(ctx, x - s, y - s, s * 2, s * 2, 7);
  ctx.fill();
  ctx.stroke();
  // liseré de classe
  ctx.strokeStyle = classColor + 'aa';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - s + 3, y - s + 3, s * 2 - 6, s * 2 - 6, 5);
  ctx.stroke();
  if (buffed) {
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(x + s - 4, y - s + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '19px "Segoe UI Emoji", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y + 1);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyInst, time: number): void {
  const { x, y } = e.pos;
  const r = e.def.radius;
  const wob = Math.sin(time * 6 + e.uid) * 0.08;
  ctx.save();

  if (e.def.kind !== 'normal') {
    // aura d'élite / boss
    ctx.strokeStyle = e.def.kind === 'boss' ? 'rgba(255,120,120,0.5)' : 'rgba(255,190,90,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, r + 5 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // corps
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  grad.addColorStop(0, e.def.color);
  grad.addColorStop(1, e.def.color2 ?? e.def.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (1 + wob), r * (1 - wob), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // yeux
  ctx.fillStyle = '#1a1424';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.15, Math.max(1.5, r * 0.13), 0, Math.PI * 2);
  ctx.arc(x + r * 0.3, y - r * 0.15, Math.max(1.5, r * 0.13), 0, Math.PI * 2);
  ctx.fill();

  if (e.enraged) {
    ctx.fillStyle = '#ff5e5e';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('💢', x, y - r - 14);
  }

  // barre de PV
  const pct = Math.max(0, e.hp / e.maxHp);
  const bw = Math.max(18, r * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - bw / 2, y - r - 8, bw, 4);
  ctx.fillStyle = pct > 0.5 ? '#6ee06e' : pct > 0.25 ? '#ffd75e' : '#ff6b5e';
  ctx.fillRect(x - bw / 2, y - r - 8, bw * pct, 4);

  // pips d'état
  let px = x - bw / 2;
  const py = y - r - 13;
  const pip = (color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + 2, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    px += 7;
  };
  if (e.poisonStacks >= 1) {
    pip('#7de08a');
    if (e.poisonStacks >= 2) {
      ctx.fillStyle = '#7de08a';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(String(Math.floor(e.poisonStacks)), px, py + 3);
      px += 10;
    }
  }
  if (e.bleed) pip('#ff6b5e');
  if (e.burn) pip('#ffb26b');
  if (e.slows.length) pip('#7fb2ff');
  if (e.mark) pip('#e08ae0');

  // armure
  if (e.def.armor > 0) {
    ctx.fillStyle = '#c8d2e0';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`🛡${e.def.armor}`, x, y + r + 10);
  }
  ctx.restore();
}

function drawGhost(g: Game, ctx: CanvasRenderingContext2D): void {
  const run = g.run!;
  if (g.ui.selectedBench == null || !g.ui.hoverCell) return;
  const t = run.towers.find((x) => x.uid === g.ui.selectedBench);
  if (!t) return;
  const def = TOWERS[t.defId];
  const cell = g.ui.hoverCell;
  const x = (cell.x + 0.5) * CELL;
  const y = (cell.y + 0.5) * CELL;
  const ok = cellBuildable(g, cell);
  const stats = towerEffStats(run, t);
  drawRange(ctx, x, y, stats.range, ok ? '#7de08a' : '#ff6b5e');
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawTower(ctx, x, y, def.glyph, CLASS_COLORS[def.classId], ok ? '#7de08a' : '#ff6b5e', false, false);
  ctx.restore();
  // surbrillance de la case
  ctx.save();
  ctx.strokeStyle = ok ? 'rgba(125,224,138,0.8)' : 'rgba(255,107,94,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cell.x * CELL + 1, cell.y * CELL + 1, CELL - 2, CELL - 2);
  ctx.restore();
}
