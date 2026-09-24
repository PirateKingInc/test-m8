// Shared test setup: the same PathFinding.js the browser loads from the CDN.
import PF from 'pathfinding';
import { World } from '../src/sim/world.js';

globalThis.PF = PF;

export { PF };

export function makeWorld(opts = {}) {
  return new World({ PF, ...opts });
}

// An open custom map with optional rock rects, no nodes and no starting units.
export function openMap({ cols = 30, rows = 20, rocks = [], nodes = [] } = {}) {
  return { cols, rows, tile: 32, startingLumen: 1000, nodeAmount: 1500, nodeSize: 2, rocks, nodes, start: null };
}

export function emptyWorld(mapOpts = {}, opts = {}) {
  return new World({ PF, map: openMap(mapOpts), setup: 'none', ...opts });
}

export const tileCenter = (tx, ty) => ({ x: (tx + 0.5) * 32, y: (ty + 0.5) * 32 });

// Step until pred() is true or the time limit passes; returns elapsed sim seconds.
export function runUntil(world, pred, maxSeconds = 120) {
  const start = world.time;
  while (!pred()) {
    if (world.time - start > maxSeconds) return Infinity;
    world.step();
  }
  return world.time - start;
}
