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
    + `crossed ${ai.stats.reachedEnemySide}, engaged ${ai.stats.engaged}, reached base ${ai.stats.reachedEnemyBase}, result ${JSON.stringify({ winner: result.winner, reason: result.reason, t: Math.round(result.time) })}`);
  assert.equal(ai.step, s.opening.length, 'every opening step executed');
  openingDoneAt.forEach((t, i) => assert.ok(t < 300, `opening step ${i} done by 5:00 (at ${t.toFixed(0)}s)`));
  assert.ok(trainedArmy >= 10, `trained an army (${trainedArmy})`);
  assert.ok(ai.stats.waves >= 1, 'launched at least one attack wave');
  assert.ok(ai.stats.reachedEnemySide, 'a wave marched into the enemy half');
  assert.ok(ai.stats.engaged, 'a wave engaged the enemy');
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

test('Turtle-and-Tech plays its full build/train/attack sequence against the fixed player script', () => {
  const run = playthrough('turtle');
  assertFullSequence(run, 'turtle');
  const { ai, m } = run;
  assert.ok(ai.stats.built.spire >= 2, `builds Spires (${ai.stats.built.spire})`);
  const heavy = (ai.stats.trained.bulwark || 0) + (ai.stats.trained.lancer || 0);
  const all = ['striker', 'sparker', 'bulwark', 'lancer'].reduce((n, t) => n + (ai.stats.trained[t] || 0), 0);
  assert.ok(heavy / all >= 0.6, `favours Bulwark/Lancer (${heavy}/${all})`);
  const core = [...m.world.ofKind('building')].find((b) => b.team === 2 && b.type === 'core') || { x: 69 * 32 };
  const spires = [...m.world.ofKind('building')].filter((b) => b.team === 2 && b.type === 'spire');
  assert.ok(spires.every((sp) => sp.x < core.x), 'Spires stand on the front, toward the enemy');
});

// The last link of the attack chain for every strategy: against an undefended
// player (no brain), the AI's waves must reach the base and destroy the Command
// Core, ending the match as a win.
for (const strategy of ['rush', 'boom', 'turtle']) {
  test(`${strategy} marches on an undefended base and destroys the Command Core`, () => {
    const m = new Match({ seed: 5, PF, ai: { strategy, difficulty: 'hard' }, player: null, view: readonly });
    const r = m.runToEnd();
    console.log(`# ${strategy} vs undefended: ${r.reason} at ${Math.round(r.time)}s, core assaults ${m.ai.stats.coreAssaults}`);
    assert.deepEqual([r.winner, r.reason], [2, 'core-destroyed']);
    assert.ok(m.ai.stats.reachedEnemyBase && m.ai.stats.coreAssaults >= 1, 'issued a direct attack on the Core');
    assert.ok(r.time < 900, 'well before the time limit');
  });
}
