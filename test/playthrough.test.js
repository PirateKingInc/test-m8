// Phase 2 strategy playthroughs: each AI strategy plays a full match against the
// fixed player-side 'sentinel' script, entirely through a read-only view of the
// world (any direct mutation throws), and must run its whole sequence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PF } from './helpers.js';
import { Match } from '../src/ai/match.js';
import { readonly } from '../src/ai/readonly.js';
import { STRATEGIES } from '../src/data/strategies.js';
import { COMBAT_TYPES } from '../src/ai/engine.js';

export function playthrough(strategy, { seed = 11, difficulty = 'hard' } = {}) {
  const m = new Match({ seed, PF, ai: { strategy, difficulty }, player: { strategy: 'sentinel', difficulty: 'hard' }, view: readonly });
  const openingDoneAt = [];
  let lastStep = 0;
  while (!m.world.result) {
    m.step();
    if (m.ai.step !== lastStep) { lastStep = m.ai.step; openingDoneAt.push(m.world.time); }
  }
  return { m, ai: m.ai, result: m.world.result, openingDoneAt };
}

export function assertFullSequence({ ai, result, openingDoneAt }, strategy) {
  const s = STRATEGIES[strategy];
  const trainedArmy = COMBAT_TYPES.reduce((n, t) => n + (ai.stats.trained[t] || 0), 0);
  console.log(`# ${strategy}: opening done at ${openingDoneAt.at(-1)?.toFixed(0)}s, army trained ${trainedArmy}, waves ${ai.stats.waves}, `
    + `reached enemy base ${ai.stats.reachedEnemyBase}, result ${JSON.stringify({ winner: result.winner, reason: result.reason, t: Math.round(result.time) })}`);
  assert.equal(ai.step, s.opening.length, 'every opening step executed');
  openingDoneAt.forEach((t, i) => assert.ok(t < 300, `opening step ${i} done by 5:00 (at ${t.toFixed(0)}s)`));
  assert.ok(trainedArmy >= 10, `trained an army (${trainedArmy})`);
  assert.ok(ai.stats.waves >= 1, 'launched at least one attack wave');
  assert.ok(ai.stats.reachedEnemyBase, 'an attack reached the enemy base');
  assert.ok(['core-destroyed', 'time-limit', 'draw'].includes(result.reason), 'the match ended with a declared result');
  assert.ok(ai.stats.commands > 50 && ai.stats.rejected / ai.stats.commands < 0.2, 'the engine kept issuing valid commands');
}

test('Rush plays its full build/train/attack sequence against the fixed player script', () => {
  assertFullSequence(playthrough('rush'), 'rush');
});

test('Economy-Boom plays its full build/train/attack sequence against the fixed player script', () => {
  const run = playthrough('boom');
  assertFullSequence(run, 'boom');
  const { ai } = run;
  assert.ok(ai.stats.built.depot >= 3, `booms with extra Depots (${ai.stats.built.depot})`);
  assert.ok(ai.stats.built.foundry >= 2, `out-produces with 2+ Foundries (${ai.stats.built.foundry})`);
  assert.ok((ai.stats.trained.drone || 0) + 4 >= 14, 'grows a big economy');
});
