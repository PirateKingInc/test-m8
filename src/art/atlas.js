// Bakes every code-drawn sprite into a Phaser texture once, at startup.
// Textures are drawn at ART_SCALE x resolution so they stay crisp when zoomed.
import { UNIT_TYPES, UNIT_BOX, drawUnitSprite, drawTeamRing } from './units.js';
import { BUILDING_TYPES, STATES, BUILDING_MARGIN, drawBuildingSprite } from './buildings.js';
import { BUILDINGS } from '../data/buildings.js';

export const ART_SCALE = 2;
export const TEAMS = [1, 2];
export const RING_R = 12; // world-px radius the ring texture is drawn for

// Texture keys, shared with the renderer.
export const unitKey = (type, team, carry = false) => `u-${type}-${team}${carry ? '-carry' : ''}`;
export const ringKey = (team) => `ring-${team}`;
export const buildingKey = (type, team, state) => `b-${type}-${team}-${state}`;

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

// Footprints come from the (frozen) building data: 1 tile = 32 px.
export function bakeBuildings(textures, tile = 32) {
  const keys = [];
  for (const team of TEAMS) for (const type of BUILDING_TYPES) for (const state of STATES) {
    const w = BUILDINGS[type].w * tile, h = BUILDINGS[type].h * tile;
    keys.push(bake(textures, buildingKey(type, team, state), w + 2 * BUILDING_MARGIN, h + 2 * BUILDING_MARGIN, (ctx) => drawBuildingSprite(ctx, type, team, state, w, h)));
  }
  return keys;
}

// Everything the game needs; the terrain slice adds crystals and ground here.
export function bakeAll(textures) {
  return [...bakeUnits(textures), ...bakeBuildings(textures)];
}
