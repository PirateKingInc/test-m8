// Unit sprites, drawn with the Canvas 2D API around (0, 0), facing +x, in world
// pixels (the atlas scales for resolution). Pure drawing: no game state.
import { TEAM, INK, METAL, LUMEN, WARM } from './palette.js';

// World-pixel box every unit sprite is drawn into (centered).
export const UNIT_BOX = 64;

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke = INK, width = 1.6) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// A soft top-left highlight over whatever path is current.
function sheen(ctx, x, y, r, alpha = 0.35) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0, x, y, r * 1.2);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
}

const DRAW = {
  // Round hull, two glowing rotor rings, a cargo pod and one big friendly eye.
  drone(ctx, t, { carry = false } = {}) {
    for (const s of [-1, 1]) { // rotor arms and rings
      ctx.fillStyle = METAL.dark;
      ctx.fillRect(-2, s * 3, 4, s * 6);
      circle(ctx, 0, s * 10, 5.2);
      ctx.fillStyle = 'rgba(200, 255, 250, 0.22)';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = t.glow;
      ctx.stroke();
      circle(ctx, 0, s * 10, 1.4);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    circle(ctx, -6.5, 0, 3.6); // cargo pod behind
    fillStroke(ctx, carry ? LUMEN.base : METAL.base);
    if (carry) { circle(ctx, -7.2, -0.8, 1.4); ctx.fillStyle = LUMEN.light; ctx.fill(); }
    circle(ctx, 0, 0, 6.8); // hull
    fillStroke(ctx, t.base);
    sheen(ctx, 0, 0, 6.8, 0.45);
    circle(ctx, 2.6, 0, 2.6); // eye
    fillStroke(ctx, '#ffffff', INK, 1.2);
    circle(ctx, 3.4, 0, 1.2);
    ctx.fillStyle = INK;
    ctx.fill();
  },

  // A sleek arrowhead with two forward blades.
  striker(ctx, t) {
    for (const s of [-1, 1]) {
      path(ctx, [[4, s * 3], [17, s * 7.5], [15, s * 9.5], [2, s * 6]]);
      fillStroke(ctx, METAL.light, INK, 1.2);
    }
    path(ctx, [[14, 0], [-9, -10], [-4, 0], [-9, 10]]);
    fillStroke(ctx, t.base);
    path(ctx, [[14, 0], [-9, -10], [-4, 0]]);
    ctx.fillStyle = t.light;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    path(ctx, [[6, 0], [-2, -3], [-2, 3]]);
    fillStroke(ctx, INK, INK, 1);
  },

  // A wide kite hull with twin forward prongs and a glowing orb between them:
  // a fork, where the Lancer is a single long spear.
  sparker(ctx, t) {
    for (const sy of [-1, 1]) {
      path(ctx, [[2, sy * 4], [16, sy * 7.5], [16, sy * 4.5], [4, sy * 1.5]]);
      fillStroke(ctx, '#dff6ff', INK, 1.2);
    }
    circle(ctx, 14, 0, 3.2);
    fillStroke(ctx, '#9fe8ff', INK, 1);
    circle(ctx, 14, 0, 1.4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    path(ctx, [[8, 0], [-2, -11], [-10, 0], [-2, 11]]);
    fillStroke(ctx, t.base);
    path(ctx, [[8, 0], [-2, -11], [-10, 0]]);
    ctx.fillStyle = t.light;
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, -1.5, 0, 3.4);
    fillStroke(ctx, '#fff29a', INK, 1.2);
  },

  // The biggest unit: a wide armoured body with a bright shield plate in front.
  bulwark(ctx, t) {
    ctx.beginPath();
    ctx.roundRect(-15, -15, 27, 30, 5);
    fillStroke(ctx, t.base, INK, 2);
    ctx.beginPath();
    ctx.roundRect(-10, -10, 16, 20, 3);
    fillStroke(ctx, t.dark, INK, 1.2);
    for (const [x, y] of [[-12, -12], [-12, 12], [9, -12], [9, 12]]) { circle(ctx, x, y, 1.3); ctx.fillStyle = METAL.light; ctx.fill(); }
    ctx.beginPath(); // shield plate
    ctx.roundRect(12, -16, 7, 32, 3);
    fillStroke(ctx, '#e8eef5', INK, 1.6);
    ctx.fillStyle = 'rgba(160, 180, 200, 0.6)';
    ctx.fillRect(14, -13, 2, 26);
    circle(ctx, -2, 0, 4);
    fillStroke(ctx, t.light, INK, 1.2);
  },

  // A round body carrying a very long golden lance cannon.
  lancer(ctx, t) {
    path(ctx, [[0, -2.2], [25, -1.4], [25, 1.4], [0, 2.2]]);
    fillStroke(ctx, WARM.base, INK, 1.2);
    path(ctx, [[25, -4], [31, 0], [25, 4]]);
    fillStroke(ctx, WARM.light, INK, 1.2);
    ctx.fillStyle = WARM.dark;
    ctx.fillRect(8, -3, 3, 6);
    circle(ctx, 0, 0, 9.2);
    fillStroke(ctx, t.base);
    sheen(ctx, 0, 0, 9.2);
    circle(ctx, -1, 0, 4);
    fillStroke(ctx, INK, INK, 1);
    circle(ctx, -1, 0, 1.6);
    ctx.fillStyle = WARM.base;
    ctx.fill();
  },

  // Verification-only test target (dev panel): a bullseye, not a game unit.
  dummy(ctx, t) {
    for (const [r, c] of [[12, '#f2e6d8'], [8.5, t.base], [5, '#f2e6d8'], [2, t.base]]) { circle(ctx, 0, 0, r); fillStroke(ctx, c, INK, r === 12 ? 1.6 : 0.6); }
  },
};

export const UNIT_TYPES = ['drone', 'striker', 'sparker', 'bulwark', 'lancer', 'dummy'];

// Draw one unit sprite at the current transform's origin.
export function drawUnitSprite(ctx, type, team, opts) {
  DRAW[type](ctx, TEAM[team] || TEAM[2], opts);
}

// The team ground ring drawn under every unit (does not rotate).
export function drawTeamRing(ctx, team, r) {
  const t = TEAM[team] || TEAM[2];
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 1.35, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.base;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
