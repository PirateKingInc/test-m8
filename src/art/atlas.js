// Bakes every code-drawn sprite into a Phaser texture once, at startup.
// Textures are drawn at ART_SCALE x resolution so they stay crisp when zoomed.
import { UNIT_TYPES, UNIT_BOX, drawUnitSprite, drawTeamRing } from './units.js';

export const ART_SCALE = 2;
export const TEAMS = [1, 2];
export const RING_R = 12; // world-px radius the ring texture is drawn for

// Texture keys, shared with the renderer.
export const unitKey = (type, team, carry = false) => `u-${type}-${team}${carry ? '-carry' : ''}`;
export const ringKey = (team) => `ring-${team}`;

// Create a canvas texture of w x h world px and draw into it (origin at center).
export function bake(textures, key, w, h, draw) {
  if (textures.exists(key)) textures.remove(key);
  const tex = textures.createCanvas(key, Math.ceil(w * ART_SCALE), Math.ceil(h * ART_SCALE));
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}

export function bakeUnits(textures) {
  const keys = [];
  for (const team of TEAMS) {
    for (const type of UNIT_TYPES) keys.push(bake(textures, unitKey(type, team), UNIT_BOX, UNIT_BOX, (ctx) => drawUnitSprite(ctx, type, team)));
    keys.push(bake(textures, unitKey('drone', team, true), UNIT_BOX, UNIT_BOX, (ctx) => drawUnitSprite(ctx, 'drone', team, { carry: true })));
    keys.push(bake(textures, ringKey(team), RING_R * 3, RING_R * 2.4, (ctx) => drawTeamRing(ctx, team, RING_R)));
  }
  return keys;
}

// Everything the game needs; later slices add buildings and terrain here.
export function bakeAll(textures) {
  return [...bakeUnits(textures)];
}
