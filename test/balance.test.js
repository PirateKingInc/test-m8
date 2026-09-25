// Phase 3 balance tooling: the batch runner's pieces, plus one full bot-vs-bot
// playthrough to a result on every CI run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../tools/match-runner.mjs';
import { jobsFor, runPool, aggregate, report, wilson, worstMatchup, worstSideSkew } from '../tools/balance-lib.mjs';

test('job list: every unordered strategy pair (mirrors included) x tier x seed', () => {
  const jobs = jobsFor({ seeds: 3 });
  assert.equal(jobs.length, 6 * 3 * 3);
  assert.deepEqual(jobsFor({ seeds: 2, tiers: ['hard'], seedOffset: 100 }).map((j) => j.seed).slice(0, 2), [101, 102]);
});

test('Wilson interval brackets the observed rate', () => {
  const [lo, hi] = wilson(60, 100);
  assert.ok(lo < 0.6 && hi > 0.6 && lo > 0.49 && hi < 0.7, `${lo} ${hi}`);
  assert.deepEqual(wilson(0, 0), [0, 1]);
});

test('full bot-vs-bot playthrough: Boom vs Turtle at Hard timing plays to a result, deterministically', () => {
  const r = playMatch('boom', 'turtle', 'hard', 1);
  assert.ok(['core-destroyed', 'time-limit', 'draw'].includes(r.reason), `reason ${r.reason}`);
  assert.ok(r.time > 60 && r.time <= 1800, `ended at ${r.time}s`);
  if (r.reason !== 'time-limit') assert.notEqual(r.winner, null, 'a Core fell, so someone won');
  assert.equal(r.side, r.winner === 'a' ? 'west' : r.winner === 'b' ? 'east' : null, 'odd seed puts a in the west');
  assert.deepEqual(playMatch('boom', 'turtle', 'hard', 1), r, 'same seed, same result');
  console.log(`playthrough: boom (west) vs turtle (east) at hard -> ${r.winner ? (r.winner === 'a' ? 'boom' : 'turtle') : 'draw'} wins by ${r.reason} at ${r.time}s`);
});

test('the pool runs matches in child processes and the report aggregates them', async () => {
  const jobs = [{ a: 'rush', b: 'rush', tier: 'hard', seed: 1 }, { a: 'rush', b: 'boom', tier: 'hard', seed: 1 }, { a: 'rush', b: 'boom', tier: 'hard', seed: 2 }];
  const results = await runPool(jobs, { workers: 2 });
  assert.equal(results.length, 3);
  assert.deepEqual(results.find((r) => r.b === 'boom' && r.seed === 2), playMatch('rush', 'boom', 'hard', 2), 'a worker gives the in-process result');
  const cells = aggregate(results);
  assert.equal(cells['hard|rush|boom'].n, 2);
  assert.match(report(cells, { title: 't' }), /Hard timing/);
  assert.ok(worstMatchup(cells).rate >= 0.5);
  assert.ok(worstSideSkew(cells).skew >= 0);
});
