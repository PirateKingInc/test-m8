// One headless AI-vs-AI match, used by the balance batch runner and its tests.
import { createRequire } from 'node:module';
import { Match } from '../src/ai/match.js';

// The exact PathFinding.js bundle the browser loads from the CDN (UMD).
const PF = createRequire(import.meta.url)('pathfinding/visual/lib/pathfinding-browser.min.js');

// Strategy `a` vs strategy `b`, both on difficulty `tier`. Odd seeds put `a` in
// the west (team 1) and even seeds in the east (team 2), so off-diagonal cells
// cancel any side bias; mirror cells (a === b) measure it.
export function playMatch(a, b, tier, seed) {
  const aWest = seed % 2 === 1;
  const west = { strategy: aWest ? a : b, difficulty: tier };
  const east = { strategy: aWest ? b : a, difficulty: tier };
  const m = new Match({ seed, PF, player: west, ai: east });
  const r = m.runToEnd();
  const westWon = r.winner === 1, eastWon = r.winner === 2;
  const aWon = aWest ? westWon : eastWon, bWon = aWest ? eastWon : westWon;
  return {
    a, b, tier, seed,
    winner: aWon ? 'a' : bWon ? 'b' : null,
    side: westWon ? 'west' : eastWon ? 'east' : null,
    reason: r.reason,
    time: Math.round(r.time),
    scores: r.scores,
  };
}
