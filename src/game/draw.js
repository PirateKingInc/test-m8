// Procedural art. Everything is drawn with Phaser Graphics; there are no asset files.
import { createRng } from '../sim/rng.js';

export const TEAM_COLORS = { 1: 0x39d3c3, 2: 0xff7a45 };
const GROUND = [0x19212d, 0x1a222f, 0x1b2330, 0x1a2230];
const ROCK = 0x3a4150, ROCK_LIGHT = 0x566073, ROCK_DARK = 0x262b35;
const CRYSTAL = 0xb69bff, CRYSTAL_DARK = 0x6a4fd0, CRYSTAL_GLOW = 0xe4d8ff;

export function drawTerrain(g, world) {
  const { grid } = world, T = grid.tile, rng = createRng(7);
  for (let ty = 0; ty < grid.rows; ty++) {
    for (let tx = 0; tx < grid.cols; tx++) {
      g.fillStyle(GROUND[Math.floor(rng.next() * GROUND.length)], 1);
      g.fillRect(tx * T, ty * T, T, T);
      if (rng.next() < 0.08) {
        g.fillStyle(0x243044, 1);
        g.fillCircle(tx * T + rng.range(6, 26), ty * T + rng.range(6, 26), rng.range(1, 2.5));
      }
    }
  }
  g.lineStyle(1, 0x222c3c, 0.35);
  for (let x = 0; x <= grid.cols; x += 4) g.lineBetween(x * T, 0, x * T, grid.rows * T);
  for (let y = 0; y <= grid.rows; y += 4) g.lineBetween(0, y * T, grid.cols * T, y * T);
  for (let ty = 0; ty < grid.rows; ty++) {
    for (let tx = 0; tx < grid.cols; tx++) {
      if (!grid.rock[grid.idx(tx, ty)]) continue;
      const x = tx * T, y = ty * T, j = rng.range(-3, 3);
      g.fillStyle(ROCK_DARK, 1);
      g.fillRect(x, y, T, T);
      g.fillStyle(ROCK, 1);
      g.fillTriangle(x + 2, y + T - 2, x + T / 2 + j, y + 3, x + T - 2, y + T - 2);
      g.fillStyle(ROCK_LIGHT, 1);
      g.fillTriangle(x + T / 2 + j, y + 3, x + T / 2 + j + 5, y + 12, x + T / 2 + j - 4, y + 12);
    }
  }
}

export function drawNode(g, n, t) {
  const fill = n.amount / n.maxAmount;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 + n.id);
  g.fillStyle(CRYSTAL_DARK, 0.25 + 0.15 * pulse);
  g.fillCircle(n.x, n.y, 30);
  const shards = [[-14, 10, 9, 26], [0, 12, 12, 34], [14, 10, 8, 22], [-5, 16, 6, 16], [8, 18, 6, 14]];
  const scale = 0.55 + 0.45 * fill;
  for (const [dx, by, w, h] of shards) {
    const bx = n.x + dx, base = n.y + by * 0.6, top = base - h * scale;
    g.fillStyle(CRYSTAL_DARK, 1);
    g.fillTriangle(bx - w / 2, base, bx, top, bx + w / 2, base);
    g.fillStyle(CRYSTAL, 1);
    g.fillTriangle(bx - w / 4, base - 2, bx, top + 2, bx + w / 2 - 1, base - 1);
    g.fillStyle(CRYSTAL_GLOW, 0.5 + 0.4 * pulse);
    g.fillTriangle(bx - 1, top + 5, bx, top + 1, bx + 2, top + 8);
  }
}

// Construction progress bar under an unfinished building's footprint.
export function drawProgress(g, b) {
  const l = b.x - b.pw / 2 + 6, w = b.pw - 12, y = b.y + b.ph / 2 - 10;
  g.fillStyle(0x000000, 0.7);
  g.fillRect(l - 1, y - 1, w + 2, 7);
  g.fillStyle(0xffc24a, 1);
  g.fillRect(l, y, w * b.progress, 5);
}

const SELECT = 0x7dffb0;
const MARKER_COLORS = { move: 0x7dffb0, attack: 0xff5a5a, gather: 0xb69bff, build: 0xffc24a };

export function drawSelection(g, e, x, y) {
  g.lineStyle(2, e.team && e.team !== 1 ? 0xff5a5a : SELECT, 0.9);
  if (e.kind === 'unit') g.strokeEllipse(x, y + e.radius * 0.35, e.radius * 2.6, e.radius * 1.5);
  else g.strokeRect(x - e.pw / 2 - 2, y - e.ph / 2 - 2, e.pw + 4, e.ph + 4);
}

// Returns false once the marker has expired.
export function drawMarker(g, m, now) {
  const age = now - m.t, life = 0.7;
  if (age > life) return false;
  const k = 1 - age / life;
  g.lineStyle(2, MARKER_COLORS[m.kind] ?? SELECT, k);
  g.strokeCircle(m.x, m.y, 4 + 14 * k);
  g.strokeCircle(m.x, m.y, 2 + 26 * (1 - k) * (1 - k)); // outward pulse
  g.lineBetween(m.x - 5, m.y, m.x + 5, m.y);
  g.lineBetween(m.x, m.y - 5, m.x, m.y + 5);
  return true;
}

export function drawGhost(g, gh, T) {
  const color = gh.valid ? 0x7dffb0 : 0xff5a5a;
  g.fillStyle(color, 0.22);
  g.fillRect(gh.tx * T, gh.ty * T, gh.w * T, gh.h * T);
  g.lineStyle(2, color, 0.9);
  g.strokeRect(gh.tx * T, gh.ty * T, gh.w * T, gh.h * T);
  g.lineStyle(1, color, 0.35);
  for (let i = 1; i < gh.w; i++) g.lineBetween((gh.tx + i) * T, gh.ty * T, (gh.tx + i) * T, (gh.ty + gh.h) * T);
  for (let i = 1; i < gh.h; i++) g.lineBetween(gh.tx * T, (gh.ty + i) * T, (gh.tx + gh.w) * T, (gh.ty + i) * T);
}

export function drawHealth(g, x, y, w, frac) {
  const f = Math.max(0, Math.min(1, frac));
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  g.fillStyle(f > 0.6 ? 0x5cff8a : f > 0.3 ? 0xffd24a : 0xff5a5a, 1);
  g.fillRect(x - w / 2, y, w * f, 3);
}

export function drawCrosshair(g, p, color) {
  g.lineStyle(2, color, 0.9);
  g.strokeCircle(p.x, p.y, 10);
  g.lineBetween(p.x - 15, p.y, p.x - 5, p.y);
  g.lineBetween(p.x + 5, p.y, p.x + 15, p.y);
  g.lineBetween(p.x, p.y - 15, p.x, p.y - 5);
  g.lineBetween(p.x, p.y + 5, p.x, p.y + 15);
}
