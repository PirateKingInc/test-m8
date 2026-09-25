// Phase 2 scalable enemy scanning: identical results to brute force, bounded work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { emptyWorld } from './helpers.js';
import { findEnemy } from '../src/sim/combat.js';
import { gap } from '../src/sim/geometry.js';
import { createRng } from '../src/sim/rng.js';
import { SIM_DT } from '../src/sim/constants.js';

// The Phase 1 algorithm, kept here as the reference.
function bruteForce(world, e, range) {
  let best = null, bestScore = Infinity;
  for (const t of world.entities.values()) {
    if (!(t.team && t.team !== e.team && t.hp > 0 && (t.kind === 'unit' || t.kind === 'building'))) continue;
    const d = gap(e, t);
    if (d > range) continue;
    const score = d + (t.kind === 'building' ? 10000 : 0);
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

const TYPES = ['striker', 'sparker', 'bulwark', 'lancer', 'drone', 'dummy'];

test('spatial findEnemy picks exactly the brute-force target (400 random worlds)', () => {
  const rng = createRng(7);
  let nonNull = 0;
  for (let trial = 0; trial < 400; trial++) {
    const w = emptyWorld({ cols: 50, rows: 40 });
    const n = rng.int(1, 60);
    for (let i = 0; i < n; i++) {
      const team = rng.int(1, 2);
      if (rng.next() < 0.15) {
        const type = ['depot', 'spire', 'foundry'][rng.int(0, 2)];
        const tx = rng.int(0, 45), ty = rng.int(0, 35);
        if (w.grid.isRectFree(tx, ty, 3, 3)) w.addBuilding(type, team, tx, ty, { built: rng.next() < 0.7 });
      } else {
        const u = w.addUnit(TYPES[rng.int(0, TYPES.length - 1)], team, rng.range(0, 1600), rng.range(0, 1280));
        if (rng.next() < 0.05) u.hp = 0; // dead but not yet swept
      }
    }
    w.spatial.rebuild(w);
    const all = [...w.entities.values()];
    for (let q = 0; q < 10; q++) {
      const e = all[rng.int(0, all.length - 1)];
      const range = [8, 128, 176, 200, 224, 320][rng.int(0, 5)];
      const expect = bruteForce(w, e, range);
      const got = findEnemy(w, e, range);
      assert.equal(got?.id ?? null, expect?.id ?? null, `trial ${trial}: entity ${e.id} range ${range}`);
      if (expect) nonNull++;
    }
  }
  assert.ok(nonNull > 1000, `enough non-trivial cases (${nonNull})`);
});

function battle(perSide, spacing = 40) {
  const w = emptyWorld({ cols: 80, rows: 60 });
  const cols = 10;
  for (let i = 0; i < perSide; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    w.addUnit(TYPES[i % 4], 1, 300 + c * spacing, 200 + r * spacing);
    w.addUnit(TYPES[i % 4], 2, 2200 - c * spacing, 200 + r * spacing);
  }
  for (const team of [1, 2]) {
    const ids = [...w.ofKind('unit')].filter((u) => u.team === team).map((u) => u.id);
    w.issue({ type: 'attackMove', ids, x: 1250, y: 200 + (perSide / cols) * spacing / 2, team });
  }
  return w;
}

function measure(w, seconds) {
  const times = [];
  w.spatial.visits = 0;
  const q0 = w.spatial.stamp;
  for (let t = 0; t < seconds / SIM_DT; t++) {
    const t0 = performance.now();
    w.step();
    times.push(performance.now() - t0);
  }
  const queries = w.spatial.stamp - q0;
  return { avgMs: times.reduce((a, b) => a + b, 0) / times.length, visitsPerQuery: w.spatial.visits / Math.max(1, queries), queries };
}

test('200-unit battle (100 vs 100) stays within the 8 ms/step budget', () => {
  const w = battle(100);
  const r = measure(w, 30);
  const dead = 200 - [...w.ofKind('unit')].length;
  console.log(`# 200-unit battle: avg ${r.avgMs.toFixed(2)} ms/step, ${r.visitsPerQuery.toFixed(1)} candidates per scan, ${dead} casualties in 30 s`);
  assert.ok(dead > 20, 'the armies actually fought');
  assert.ok(r.avgMs < 8, `avg ${r.avgMs} ms/step`);
});

// Same local density, more of the world: `n` separate 5-vs-5 skirmishes 1000 px apart.
function skirmishes(n) {
  const w = emptyWorld({ cols: 160, rows: 128 });
  for (let k = 0; k < n; k++) {
    const ox = 400 + (k % 5) * 1000, oy = 300 + Math.floor(k / 5) * 1000;
    for (let i = 0; i < 5; i++) {
      w.addUnit(TYPES[i % 4], 1, ox + (i % 3) * 30, oy + i * 30);
      w.addUnit(TYPES[(i + 1) % 4], 2, ox + 260 + (i % 3) * 30, oy + i * 30);
    }
  }
  return w;
}

test('scan work per query does not grow with the total entity count', () => {
  const small = measure(skirmishes(5), 10); // 50 units
  const large = measure(skirmishes(20), 10); // 200 units
  console.log(`# candidates per scan at equal density: 50 units ${small.visitsPerQuery.toFixed(1)}, 200 units ${large.visitsPerQuery.toFixed(1)} (a brute-force scan examines all 50 / 200)`);
  assert.ok(large.visitsPerQuery <= small.visitsPerQuery * 1.25 + 1, 'per-scan work is set by local density, not world size');
  assert.ok(large.visitsPerQuery < 20, 'a scan examines a handful of neighbours, not the world');
});
