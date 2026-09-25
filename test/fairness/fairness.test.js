// Phase 2 fairness proof (SPEC.md "Fairness protocol"): scripted player-side
// policies vs every difficulty tier over 12 fixed seeds each. The three tiers run
// in parallel child processes; the sim is deterministic, so the numbers are exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { REQUIRE, POLICIES } from './harness.js';

const TIERS = ['easy', 'normal', 'hard'];

function runTier(tier) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [new URL('./tier.js', import.meta.url).pathname, tier]);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      process.stdout.write(err);
      const line = out.split('\n').find((l) => l.startsWith('RESULT '));
      if (code !== 0 || !line) reject(new Error(`tier ${tier} failed (${code}): ${err}`));
      else resolve(JSON.parse(line.slice(7)));
    });
  });
}

test('every difficulty tier is beatable by a competent player and not a pushover', async () => {
  const results = Object.fromEntries(TIERS.map((t, i) => [t, null]));
  const rates = await Promise.all(TIERS.map(runTier));
  TIERS.forEach((t, i) => { results[t] = rates[i]; });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fairness.json', JSON.stringify(results, null, 2));
  const pct = (x) => `${Math.round(x * 100)}%`;
  console.log('# player win rate | ' + Object.keys(POLICIES).join(' | '));
  for (const t of TIERS) console.log(`# ${t.padEnd(6)} | ${Object.keys(POLICIES).map((p) => pct(results[t][p])).join(' | ')}`);

  for (const t of TIERS) {
    assert.ok(results[t].competent >= REQUIRE.competentMin[t], `a competent player can beat ${t} (${pct(results[t].competent)})`);
    assert.ok(results[t].novice <= REQUIRE.noviceMax, `${t} is not a pushover for a novice (${pct(results[t].novice)})`);
  }
  for (const p of Object.keys(POLICIES)) {
    assert.ok(results.easy[p] >= results.normal[p] && results.normal[p] >= results.hard[p], `${p}: harder tiers are harder`);
  }
  assert.ok(results.hard.intermediate <= 1 - REQUIRE.hardBeatsIntermediate, `Hard beats the intermediate policy (${pct(results.hard.intermediate)})`);
});
