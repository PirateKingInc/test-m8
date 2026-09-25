// Building sprites in three construction states, drawn with the Canvas 2D API
// around (0, 0) in world pixels. `w`/`h` is the gameplay footprint; the
// sprite may overhang it slightly (shadow), but the footprint stays the
// gameplay size. Pure drawing: no game state.
import { TEAM, INK, METAL, LUMEN, WARM, HAZARD } from './palette.js';

export const BUILDING_MARGIN = 8; // world px of overhang drawn around the footprint
export const STATES = ['foundation', 'frame', 'complete'];

// Construction progress -> state (see PHASE4_SPEC.md).
export const stateOf = (b) => (b.built ? 'complete' : b.progress < 0.34 ? 'foundation' : 'frame');

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function fs(ctx, fill, stroke = INK, width = 2) {
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function dome(ctx, x, y, r, t) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, t.light);
  g.addColorStop(0.55, t.base);
  g.addColorStop(1, t.dark);
  circle(ctx, x, y, r);
  fs(ctx, g);
}

// A raised block: drop shadow, front wall, then the roof `draw` on top.
// The front wall carries a team-coloured trim so allegiance reads on every building.
function block(ctx, w, h, wall, roof, t) {
  rr(ctx, -w / 2 + 4, -h / 2 + 6, w, h, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); // shadow (down-right)
  rr(ctx, -w / 2, -h / 2 + wall, w, h - wall, 8);
  fs(ctx, METAL.deep); // front wall
  if (t) { ctx.fillStyle = t.base; ctx.fillRect(-w / 2 + 6, h / 2 - 5, w - 12, 3); }
  roof(ctx, w, h - wall);
}

const COMPLETE = {
  // Hexagonal base, a big team dome, a bright core light and four pylons.
  core(ctx, w, h, t) {
    block(ctx, w - 8, h - 8, 8, (c, bw, bh) => {
      const r = bw / 2;
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; c.lineTo(Math.cos(a) * r, -4 + Math.sin(a) * (bh / 2)); }
      c.closePath();
      fs(c, METAL.dark);
      for (const [px, py] of [[-r * 0.72, -bh * 0.3], [r * 0.72, -bh * 0.3], [-r * 0.72, bh * 0.24], [r * 0.72, bh * 0.24]]) {
        rr(c, px - 7, py - 7, 14, 14, 3); fs(c, METAL.base, INK, 1.5);
        circle(c, px, py, 3.5); fs(c, t.light, null);
      }
      for (let i = 0; i < 4; i++) { // spokes
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        c.lineWidth = 5; c.strokeStyle = t.dark; c.beginPath(); c.moveTo(0, -4); c.lineTo(Math.cos(a) * r * 0.62, -4 + Math.sin(a) * r * 0.62); c.stroke();
      }
      dome(c, 0, -4, r * 0.55, t);
      circle(c, 0, -4, r * 0.28); fs(c, INK, null);
      glow(c, 0, -4, r * 0.34, t.glow);
      circle(c, 0, -4, r * 0.13); fs(c, '#ffffff', null);
    }, t);
  },

  // A round silo holding a violet crystal, with loading stripes.
  depot(ctx, w, h, t) {
    block(ctx, w - 8, h - 8, 7, (c, bw, bh) => {
      rr(c, -bw / 2, -bh / 2 - 3, bw, bh, 8); fs(c, METAL.dark);
      for (const s of [-1, 1]) { // loading stripes
        c.save(); c.beginPath(); c.rect(s < 0 ? -bw / 2 + 4 : bw / 2 - 16, bh / 2 - 17, 12, 12); c.clip();
        for (let i = -12; i < 24; i += 6) { c.fillStyle = (i / 6) % 2 ? HAZARD.black : HAZARD.yellow; c.beginPath(); c.moveTo(-bw, i); c.lineTo(bw, i - 2 * bw); c.lineTo(bw, i - 2 * bw + 3); c.lineTo(-bw, i + 3); c.fill(); }
        c.restore();
      }
      const r = bw * 0.36;
      circle(c, 0, -5, r); fs(c, t.base);
      circle(c, 0, -5, r - 4); c.lineWidth = 3; c.strokeStyle = t.dark; c.stroke();
      circle(c, 0, -5, r - 8); fs(c, INK, null);
      glow(c, 0, -5, r - 6, LUMEN.glow);
      c.beginPath(); // crystal
      c.moveTo(0, -5 - r * 0.62); c.lineTo(r * 0.36, -5); c.lineTo(0, -5 + r * 0.5); c.lineTo(-r * 0.36, -5); c.closePath();
      fs(c, LUMEN.base, INK, 1.5);
      c.beginPath(); c.moveTo(0, -5 - r * 0.62); c.lineTo(r * 0.36, -5); c.lineTo(0, -5); c.closePath(); fs(c, LUMEN.light, null);
    }, t);
  },

  // A factory: team roof with a ridge, two chimneys, a glowing furnace door.
  foundry(ctx, w, h, t) {
    block(ctx, w - 8, h - 8, 10, (c, bw, bh) => {
      const top = -bw / 2 - 2;
      rr(c, -bw / 2, top, bw, bh, 6); fs(c, t.base);
      rr(c, -bw / 2, top, bw / 2, bh, 6); c.fillStyle = t.light; c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
      c.lineWidth = 3; c.strokeStyle = t.dark; c.beginPath(); c.moveTo(0, top + 3); c.lineTo(0, top + bh - 3); c.stroke(); // ridge
      for (let i = 1; i < 4; i++) { c.lineWidth = 1; c.strokeStyle = t.dark; c.beginPath(); c.moveTo(-bw / 2 + 4, top + (i * bh) / 4); c.lineTo(bw / 2 - 4, top + (i * bh) / 4); c.stroke(); }
      for (const cx of [-bw * 0.26, -bw * 0.08]) { // chimneys
        circle(c, cx, top + 12, 7); fs(c, METAL.base, INK, 1.5);
        circle(c, cx, top + 12, 4); fs(c, INK, null);
      }
      rr(c, bw * 0.02, top + bh - 22, bw * 0.36, 16, 3); fs(c, INK, INK, 1); // furnace door
      glow(c, bw * 0.2, top + bh - 14, 20, 'rgba(255, 170, 60, 0.6)');
      rr(c, bw * 0.05, top + bh - 19, bw * 0.3, 10, 2); fs(c, WARM.base, null);
    }, t);
  },

  // A turret seen from above: tall team tower, a barrel and a glowing lens.
  spire(ctx, w, h, t) {
    block(ctx, w - 8, h - 8, 6, (c, bw, bh) => {
      rr(c, -bw / 2, -bh / 2 - 3, bw, bh, 5); fs(c, METAL.dark);
      for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(c, (px * bw) / 2.8, py * (bh / 2.8) - 3, 2.5); fs(c, t.base, null); }
    }, t);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; circle(ctx, 5, 2, 15); ctx.fill(); // tower shadow
    dome(ctx, 0, -6, 15, t);
    ctx.save(); ctx.translate(0, -6); ctx.rotate(-Math.PI / 4); // barrel toward the top-right
    rr(ctx, 4, -3, 22, 6, 2); fs(ctx, METAL.light, INK, 1.5);
    ctx.restore();
    circle(ctx, 0, -6, 8); fs(ctx, METAL.base, INK, 1.5);
    glow(ctx, 0, -6, 9, t.glow);
    circle(ctx, 0, -6, 3.5); fs(ctx, '#ffffff', null);
  },
};

function tint(c) { const a = c.globalAlpha; c.globalAlpha = 0.28; c.fill(); c.globalAlpha = a; }

// The building's type, stencilled on its pad, so every type is recognisable
// from the moment it is placed (a Depot and a Foundry share a 3x3 footprint).
const STENCIL = {
  core(c, s) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; c.lineTo(Math.cos(a) * s, Math.sin(a) * s); } c.closePath(); tint(c); c.stroke(); circle(c, 0, 0, s * 0.35); c.stroke(); },
  depot(c, s) { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.62, 0); c.lineTo(0, s); c.lineTo(-s * 0.62, 0); c.closePath(); tint(c); c.stroke(); },
  foundry(c, s) { c.beginPath(); c.rect(-s, -s * 0.15, s * 2, s * 1.1); tint(c); c.stroke(); for (const x of [-s * 0.55, s * 0.05]) { circle(c, x, -s * 0.6, s * 0.3); tint(c); c.stroke(); } },
  spire(c, s) { circle(c, 0, 0, s * 0.55); tint(c); c.stroke(); c.beginPath(); c.moveTo(s * 0.35, -s * 0.35); c.lineTo(s, -s); c.stroke(); },
};

// Foundation: a concrete pad with the team's dashed outline, stakes, blocks
// and the type's stencil.
function foundation(ctx, w, h, t, type) {
  rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6); fs(ctx, '#3a414d', null);
  ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = t.base; ctx.stroke(); ctx.setLineDash([]);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // corner stakes
    circle(ctx, (sx * (w - 14)) / 2, (sy * (h - 14)) / 2, 3); fs(ctx, HAZARD.yellow, INK, 1);
  }
  // Bold enough to read at 0.5x zoom: a translucent fill plus a thick outline.
  ctx.lineWidth = 5; ctx.strokeStyle = t.base; ctx.fillStyle = t.base;
  ctx.globalAlpha = 0.9;
  STENCIL[type](ctx, Math.min(w, h) * 0.3);
  ctx.globalAlpha = 1;
  const blocks = [[-0.3, 0.3], [0.3, 0.3]];
  for (const [bx, by] of blocks) { rr(ctx, bx * w - 6, by * h - 4, 12, 8, 2); fs(ctx, METAL.base, INK, 1.2); }
}

// Frame: the building's lower part going up inside orange scaffolding.
function frame(ctx, w, h, t, type) {
  foundation(ctx, w, h, t, type);
  ctx.save();
  ctx.beginPath(); ctx.rect(-w / 2, 0 - h * 0.08, w, h / 2 + h * 0.08); ctx.clip(); // the lower half is built
  ctx.globalAlpha = 0.9;
  COMPLETE[type](ctx, w, h, t);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip(); // scaffold stays on the footprint
  ctx.lineWidth = 2.5; ctx.strokeStyle = WARM.base; // scaffold girders
  const m = 6;
  ctx.strokeRect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m);
  ctx.lineWidth = 1.5;
  for (let x = -w / 2 + m; x < w / 2 - m; x += 16) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + m); ctx.lineTo(x + 16, h / 2 - m); ctx.stroke(); }
  for (let y = -h / 2 + m + 16; y < h / 2 - m; y += 16) { ctx.beginPath(); ctx.moveTo(-w / 2 + m, y); ctx.lineTo(w / 2 - m, y); ctx.stroke(); }
  ctx.restore();
}

export const BUILDING_TYPES = ['core', 'depot', 'foundry', 'spire'];

// Draw one building sprite (footprint w x h px) in `state`.
export function drawBuildingSprite(ctx, type, team, state, w, h) {
  const t = TEAM[team] || TEAM[2];
  if (state === 'foundation') foundation(ctx, w, h, t, type);
  else if (state === 'frame') frame(ctx, w, h, t, type);
  else COMPLETE[type](ctx, w, h, t);
}
