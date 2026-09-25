// Terrain and crystal art, drawn with the Canvas 2D API. Pure drawing: the
// rock layout is read from the grid, never changed.
import { GROUND, ROCK, LUMEN, INK } from './palette.js';

// A tiny seeded RNG for texture noise (art only; the sim has its own).
function noise(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216; };
}

// Paint the whole map (cols x rows tiles) at 1 canvas px per world px.
// isRock(tx, ty) says which tiles are impassable rock.
export function paintTerrain(ctx, cols, rows, tile, isRock) {
  const W = cols * tile, H = rows * tile, rnd = noise(7);
  ctx.fillStyle = GROUND.base;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { // soft mottling
    const x = rnd() * W, y = rnd() * H, r = 18 + rnd() * 70;
    ctx.fillStyle = GROUND.mottle[Math.floor(rnd() * GROUND.mottle.length)];
    ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2400; i++) { // pebbles
    ctx.fillStyle = rnd() < 0.5 ? '#243044' : '#141b25';
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  ctx.strokeStyle = GROUND.grid; // a faint 4-tile grid helps placement
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x += 4) { ctx.beginPath(); ctx.moveTo(x * tile + 0.5, 0); ctx.lineTo(x * tile + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= rows; y += 4) { ctx.beginPath(); ctx.moveTo(0, y * tile + 0.5); ctx.lineTo(W, y * tile + 0.5); ctx.stroke(); }

  // Rock reads as a raised wall: a shadow cast down-right, a dark cliff face on
  // the south side, the rock top, and a lit north/west edge.
  const rock = (tx, ty) => tx >= 0 && ty >= 0 && tx < cols && ty < rows && isRock(tx, ty);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) if (rock(tx, ty)) ctx.fillRect(tx * tile + 6, ty * tile + 10, tile, tile);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (!rock(tx, ty)) continue;
      const x = tx * tile, y = ty * tile;
      ctx.fillStyle = ROCK.base;
      ctx.fillRect(x, y, tile, tile);
      if (!rock(tx, ty + 1)) { ctx.fillStyle = ROCK.face; ctx.fillRect(x, y + tile - 9, tile, 9); ctx.fillStyle = ROCK.dark; ctx.fillRect(x, y + tile - 10, tile, 2); }
      if (!rock(tx, ty - 1)) { ctx.fillStyle = ROCK.light; ctx.fillRect(x, y, tile, 3); }
      if (!rock(tx - 1, ty)) { ctx.fillStyle = ROCK.light; ctx.globalAlpha = 0.6; ctx.fillRect(x, y, 2, tile); ctx.globalAlpha = 1; }
      if (!rock(tx + 1, ty)) { ctx.fillStyle = ROCK.dark; ctx.fillRect(x + tile - 3, y, 3, tile); }
      for (let k = 0; k < 3; k++) { // shaded boulders on the rock top
        const r = 5 + rnd() * 6, bx = x + r + rnd() * (tile - 2 * r), by = y + r + rnd() * Math.max(1, tile - 10 - 2 * r);
        const g = ctx.createRadialGradient(bx - r * 0.4, by - r * 0.5, 1, bx, by, r);
        g.addColorStop(0, ROCK.light); g.addColorStop(0.6, ROCK.base); g.addColorStop(1, ROCK.dark);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(bx, by, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// Crystal cluster stages: 3 = full, 2 = mined, 1 = nearly empty.
export const CRYSTAL_STAGES = [3, 2, 1];
export const stageOf = (fill) => (fill > 0.66 ? 3 : fill > 0.33 ? 2 : 1);
export const CRYSTAL_BOX = 80; // world px drawn around a 64 px (2x2) node

const SHARDS = [ // [dx, baseY, width, height], tallest first; later stages drop the smaller ones
  [0, 14, 13, 40], [-15, 16, 11, 30], [15, 15, 10, 27], [-7, 22, 8, 20], [9, 23, 8, 18], [-21, 22, 7, 14], [21, 22, 7, 13],
];

export function drawCrystal(ctx, stage) {
  const glow = ctx.createRadialGradient(0, 4, 2, 0, 4, 36);
  glow.addColorStop(0, LUMEN.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-40, -36, 80, 80);
  ctx.beginPath(); ctx.ellipse(0, 22, 26, 9, 0, 0, Math.PI * 2); // ground patch
  ctx.fillStyle = 'rgba(40, 24, 80, 0.55)'; ctx.fill();
  const count = { 3: 7, 2: 5, 1: 3 }[stage], scale = { 3: 1, 2: 0.8, 1: 0.6 }[stage];
  for (const [dx, by, w, h] of SHARDS.slice(0, count).reverse()) {
    const top = by - h * scale;
    ctx.beginPath(); ctx.moveTo(dx - w / 2, by); ctx.lineTo(dx - w * 0.2, top + 3); ctx.lineTo(dx, top); ctx.lineTo(dx + w / 2, by); ctx.closePath();
    ctx.fillStyle = LUMEN.dark; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx - w * 0.2, top + 3); ctx.lineTo(dx, top); ctx.lineTo(dx + w * 0.1, by - 1); ctx.lineTo(dx - w * 0.3, by - 1); ctx.closePath();
    ctx.fillStyle = LUMEN.base; ctx.fill();
    ctx.beginPath(); ctx.moveTo(dx - 1, top + 5); ctx.lineTo(dx, top + 2); ctx.lineTo(dx + 1.5, top + 10); ctx.closePath();
    ctx.fillStyle = LUMEN.light; ctx.fill();
  }
}
