// Shared test setup. Loads the exact PathFinding.js file the browser gets from the CDN
// (pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js, a UMD bundle), so headless
// tests exercise the same library build that ships.
import { createRequire } from 'node:module';
import { World } from '../src/sim/world.js';

const PF = createRequire(import.meta.url)('pathfinding/visual/lib/pathfinding-browser.min.js');
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
