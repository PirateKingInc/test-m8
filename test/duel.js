// Seeded 1v1 duel harness shared by the counter tests (and handy for balance checks).
import { emptyWorld } from './helpers.js';
import { UNITS } from '../src/data/units.js';
import { createRng } from '../src/sim/rng.js';

export const N = 50;
export const THRESHOLD = 0.8;

// A (team 1) faces B (team 2) on open ground, `startGap` px edge to edge. Both start
// idle and auto-acquire. Returns 'A', 'B' or 'draw' (both alive after 120 s).
export function duel(a, b, startGap, seed) {
  const w = emptyWorld({ cols: 40, rows: 20 }, { seed });
  const jitter = createRng(seed * 7919 + 1);
  const y = 10 * 32 + jitter.range(-6, 6);
  const ax = 8 * 32;
  const bx = ax + UNITS[a].radius + UNITS[b].radius + startGap;
  const A = w.addUnit(a, 1, ax, y), B = w.addUnit(b, 2, bx, y + jitter.range(-3, 3));
  for (let t = 0; t < 120 * 20; t++) {
    w.step();
    const aAlive = w.get(A.id), bAlive = w.get(B.id);
    if (!aAlive || !bAlive) return aAlive ? 'A' : bAlive ? 'B' : 'draw';
  }
  return 'draw';
}

export function winRate(a, b, startGap, n = N) {
  let wins = 0;
  for (let s = 1; s <= n; s++) if (duel(a, b, startGap, s) === 'A') wins++;
  return wins / n;
}

// [A, B, start gap, description]; A is the intended winner.
export const COUNTER_TABLE = [
  ['striker', 'sparker', 4, 'Striker beats Sparker in melee range'],
  ['sparker', 'striker', 176, 'Sparker beats Striker when the fight starts at Sparker range'],
  ['bulwark', 'striker', 4, 'Bulwark beats Striker (close)'],
  ['bulwark', 'striker', 176, 'Bulwark beats Striker (far)'],
  ['bulwark', 'sparker', 4, 'Bulwark beats Sparker (close)'],
  ['bulwark', 'sparker', 176, 'Bulwark beats Sparker (far)'],
  ['lancer', 'bulwark', 4, 'Lancer beats Bulwark (close)'],
  ['lancer', 'bulwark', 128, 'Lancer beats Bulwark (at Lancer range)'],
  ['striker', 'lancer', 4, 'Striker beats Lancer (close)'],
  ['striker', 'lancer', 128, 'Striker beats Lancer (at Lancer range)'],
  ['sparker', 'lancer', 4, 'Sparker beats Lancer (close)'],
  ['sparker', 'lancer', 176, 'Sparker beats Lancer (at Sparker range)'],
  ['striker', 'drone', 4, 'Striker beats Drone'],
  ['sparker', 'drone', 4, 'Sparker beats Drone'],
  ['bulwark', 'drone', 4, 'Bulwark beats Drone'],
  ['lancer', 'drone', 4, 'Lancer beats Drone'],
];

