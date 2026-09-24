// Verifies every row of the SPEC.md counter table with N seeded 1v1 simulations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duel, winRate, COUNTER_TABLE, N, THRESHOLD } from './duel.js';

for (const [a, b, g, desc] of COUNTER_TABLE) {
  test(`${desc}: wins >= ${THRESHOLD * 100}% of ${N} seeded fights`, () => {
    const rate = winRate(a, b, g);
    console.log(`  ${desc.padEnd(58)} ${(rate * 100).toFixed(0)}%`);
    assert.ok(rate >= THRESHOLD, `${a} won only ${(rate * 100).toFixed(0)}% vs ${b} at gap ${g}`);
  });
}

test('the range dependence is real: the same matchup flips with the starting distance', () => {
  assert.ok(winRate('striker', 'sparker', 4) >= THRESHOLD);
  assert.ok(winRate('striker', 'sparker', 176) <= 1 - THRESHOLD);
});

test('fights are deterministic for a given seed', () => {
  const runs = [1, 2, 3].map(() => duel('striker', 'sparker', 90, 42));
  assert.equal(new Set(runs).size, 1);
});
