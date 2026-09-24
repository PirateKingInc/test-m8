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

export function drawBuilding(g, b, color) {
  const l = b.x - b.pw / 2 + 3, t = b.y - b.ph / 2 + 3, w = b.pw - 6, h = b.ph - 6;
  const alpha = b.built ? 1 : 0.45 + 0.4 * b.progress;
  g.fillStyle(0x10161f, alpha);
  g.fillRoundedRect(l, t, w, h, 6);
  g.lineStyle(2, color, alpha);
  g.strokeRoundedRect(l, t, w, h, 6);
  g.fillStyle(color, 0.25 * alpha);
  g.fillRoundedRect(l + 6, t + 6, w - 12, h - 12, 4);
  const cx = b.x, cy = b.y;
  g.fillStyle(color, alpha);
  if (b.type === 'core') {
    g.fillCircle(cx, cy, 18);
    g.fillStyle(0x10161f, alpha);
    g.fillCircle(cx, cy, 10);
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(cx, cy, 5);
  } else if (b.type === 'depot') {
    g.fillRect(cx - 18, cy - 4, 36, 8);
    g.fillStyle(CRYSTAL, alpha);
    g.fillTriangle(cx - 8, cy + 14, cx, cy - 16, cx + 8, cy + 14);
  } else if (b.type === 'foundry') {
    g.fillRect(cx - 20, cy - 16, 12, 32);
    g.fillRect(cx - 4, cy - 10, 24, 20);
    g.fillStyle(0xffc24a, alpha);
    g.fillRect(cx + 2, cy - 4, 12, 8);
  } else if (b.type === 'spire') {
    g.fillTriangle(cx - 12, cy + 14, cx, cy - 18, cx + 12, cy + 14);
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(cx, cy - 6, 4);
  }
  if (!b.built) {
    g.lineStyle(1, 0xffffff, 0.35);
    for (let i = -h; i < w; i += 12) {
      g.lineBetween(l + Math.max(i, 0), t + Math.max(-i, 0), l + Math.min(i + h, w), t + Math.min(h, w - i));
    }
  }
}

// Each unit type has its own silhouette, rotated to face its heading.
export function drawUnit(g, u, x, y, color) {
  const r = u.radius, a = u.facing || 0;
  const cos = Math.cos(a), sin = Math.sin(a);
  const P = (fx, fy) => ({ x: x + fx * cos - fy * sin, y: y + fx * sin + fy * cos }); // local -> world
  const poly = (pts, fill, alpha = 1) => { g.fillStyle(fill, alpha); g.fillPoints(pts.map(([px, py]) => P(px, py)), true); };
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(x, y + r * 0.6, r * 2, r);
  const dark = 0x0b0f17;
  switch (u.type) {
    case 'drone': // small round hull with two rotor pods
      g.fillStyle(color, 1);
      g.fillCircle(P(0, -r * 0.7).x, P(0, -r * 0.7).y, r * 0.35);
      g.fillCircle(P(0, r * 0.7).x, P(0, r * 0.7).y, r * 0.35);
      g.fillCircle(x, y, r * 0.75);
      g.fillStyle(dark, 1);
      g.fillCircle(x, y, r * 0.35);
      if (u.carry > 0) { g.fillStyle(CRYSTAL, 1); g.fillCircle(x, y, r * 0.3); }
      break;
    case 'striker': // arrowhead with twin blades
      poly([[r * 1.2, 0], [-r * 0.8, -r * 0.9], [-r * 0.4, 0], [-r * 0.8, r * 0.9]], color);
      poly([[r * 0.5, -r * 0.2], [r * 1.5, -r * 0.55], [r * 0.6, -r * 0.45]], 0xffffff, 0.9);
      poly([[r * 0.5, r * 0.2], [r * 1.5, r * 0.55], [r * 0.6, r * 0.45]], 0xffffff, 0.9);
      break;
    case 'sparker': // diamond with a long emitter barrel
      poly([[r, 0], [0, -r * 0.8], [-r, 0], [0, r * 0.8]], color);
      poly([[r * 0.2, -r * 0.15], [r * 1.6, -r * 0.15], [r * 1.6, r * 0.15], [r * 0.2, r * 0.15]], 0xe6f7ff);
      g.fillStyle(0xfff29a, 1);
      g.fillCircle(x, y, r * 0.3);
      break;
    case 'bulwark': // heavy plated square with a shield front
      poly([[r, -r], [r, r], [-r, r], [-r, -r]], color);
      poly([[r * 0.7, -r * 0.7], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7]], dark);
      poly([[r * 1.25, -r * 0.9], [r * 1.25, r * 0.9], [r * 0.85, r * 0.9], [r * 0.85, -r * 0.9]], 0xdfe7ef);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r * 0.35);
      break;
    case 'lancer': // round body carrying a long lance cannon
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r * 0.85);
      poly([[0, -r * 0.18], [r * 2.1, -r * 0.1], [r * 2.1, r * 0.1], [0, r * 0.18]], 0xffc24a);
      poly([[r * 2.1, -r * 0.3], [r * 2.5, 0], [r * 2.1, r * 0.3]], 0xffc24a);
      g.fillStyle(dark, 1);
      g.fillCircle(x, y, r * 0.4);
      break;
    default: // verification-only test target: concentric rings
      g.fillStyle(0xf2e6d8, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r * 0.7);
      g.fillStyle(0xf2e6d8, 1);
      g.fillCircle(x, y, r * 0.4);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r * 0.15);
  }
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
  const age = now - m.t, life = 0.6;
  if (age > life) return false;
  const k = 1 - age / life;
  g.lineStyle(2, MARKER_COLORS[m.kind] ?? SELECT, k);
  g.strokeCircle(m.x, m.y, 4 + 14 * k);
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
