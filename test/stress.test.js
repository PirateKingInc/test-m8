// Pathfinding + steering stress: 30-40 units moving at once on the real map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { makeWorld, tileCenter } from './helpers.js';
import { SIM_DT } from '../src/sim/constants.js';

const TYPES = ['striker', 'sparker', 'bulwark', 'lancer', 'drone'];

// n units on walkable tiles in rows of `cols`, starting at (tx0, ty0).
function spawnBlock(w, n, tx0, ty0, cols, team = 1) {
  const out = [];
  for (let k = 0; out.length < n; k++) {
    const tx = tx0 + (k % cols), ty = ty0 + Math.floor(k / cols);
    if (!w.grid.isWalkable(tx, ty)) continue;
    const c = tileCenter(tx, ty);
    out.push(w.addUnit(TYPES[out.length % TYPES.length], team, c.x, c.y));
  }
  return out;
}

// Runs until every unit is idle. Tracks per-step cost and how long any pair
// stays deeply overlapped (> 25% of their combined radii) without a break.
function march(w, units, maxSeconds) {
  const stepMs = [];
  const overlapSince = new Map();
  let worstOverlap = 0;
  for (let t = 0; t < maxSeconds / SIM_DT; t++) {
    const t0 = performance.now();
    w.step();
    stepMs.push(performance.now() - t0);
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i], b = units[j], key = a.id * 1000 + b.id;
        const deep = Math.hypot(a.x - b.x, a.y - b.y) < 0.75 * (a.radius + b.radius);
        if (deep) {
          if (!overlapSince.has(key)) overlapSince.set(key, w.time);
          worstOverlap = Math.max(worstOverlap, w.time - overlapSince.get(key));
        } else overlapSince.delete(key);
      }
    }
    if (units.every((u) => u.order.type === 'idle')) break;
  }
  const avg = stepMs.reduce((s, x) => s + x, 0) / stepMs.length;
  const sorted = [...stepMs].sort((a, b) => a - b);
  return { seconds: w.time, avgMs: avg, p99Ms: sorted[Math.floor(sorted.length * 0.99)], worstOverlap, allIdle: units.every((u) => u.order.type === 'idle') };
}

function finalOverlaps(units) {
  let n = 0;
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius - 2) n++;
  }
  return n;
}

test('40 units cross the map through both ridges: all arrive, no lasting overlap, fast steps', () => {
  const w = makeWorld({ setup: 'none' });
  const units = spawnBlock(w, 40, 4, 4, 8);
  const goal = tileCenter(70, 44);
  w.issue({ type: 'move', ids: units.map((u) => u.id), ...goal });
  const r = march(w, units, 180);
  w.run(3); // settle
  const blocked = units.filter((u) => { const t = w.grid.tileOf(u.x, u.y); return !w.grid.isWalkable(t.tx, t.ty); }).length;
  const far = units.filter((u) => Math.hypot(u.x - goal.x, u.y - goal.y) > 6 * 32).length;
  console.log(`# stress-40: arrived in ${r.seconds.toFixed(1)}s sim, avg ${r.avgMs.toFixed(3)} ms/step, p99 ${r.p99Ms.toFixed(3)} ms, worst deep-overlap streak ${r.worstOverlap.toFixed(2)}s, final overlaps ${finalOverlaps(units)}, far ${far}`);
  assert.ok(r.allIdle, 'every unit finished its move (none stuck forever)');
  assert.equal(far, 0, 'every unit ended near the destination');
  assert.equal(blocked, 0, 'nobody inside rock or buildings');
  assert.equal(finalOverlaps(units), 0, 'no overlap once settled');
  assert.ok(r.worstOverlap < 3, `deep overlap lasted ${r.worstOverlap}s`);
  assert.ok(r.avgMs < 5, `avg step ${r.avgMs} ms exceeds the 5 ms budget`);
});

test('two 20-unit groups cross head-on through the same chokepoint', () => {
  const w = makeWorld({ setup: 'none' });
  const west = spawnBlock(w, 20, 20, 18, 5);
  const east = spawnBlock(w, 20, 36, 18, 5);
  const wGoal = tileCenter(40, 21), eGoal = tileCenter(22, 21);
  w.issue({ type: 'move', ids: west.map((u) => u.id), ...wGoal });
  w.issue({ type: 'move', ids: east.map((u) => u.id), ...eGoal });
  const all = [...west, ...east];
  const r = march(w, all, 120);
  w.run(3);
  const farW = west.filter((u) => Math.hypot(u.x - wGoal.x, u.y - wGoal.y) > 5 * 32).length;
  const farE = east.filter((u) => Math.hypot(u.x - eGoal.x, u.y - eGoal.y) > 5 * 32).length;
  console.log(`# crossing-40: done in ${r.seconds.toFixed(1)}s sim, avg ${r.avgMs.toFixed(3)} ms/step, worst deep-overlap streak ${r.worstOverlap.toFixed(2)}s, stragglers ${farW + farE}`);
  assert.ok(r.allIdle, 'nobody stuck forever');
  assert.equal(farW + farE, 0, 'both groups got through');
  assert.equal(finalOverlaps(all), 0);
  assert.ok(r.worstOverlap < 3);
});

test('35 units given 6 random orders in a row never get permanently stuck', () => {
  const w = makeWorld({ setup: 'none', seed: 99 });
  const units = spawnBlock(w, 35, 3, 40, 7);
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let order = 0; order < 6; order++) {
    let tx, ty;
    do { tx = Math.floor(rand() * 76) + 2; ty = Math.floor(rand() * 56) + 2; } while (!w.grid.isWalkable(tx, ty));
    const goal = tileCenter(tx, ty);
    w.issue({ type: 'move', ids: units.map((u) => u.id), ...goal });
    const r = march(w, units, 150);
    assert.ok(r.allIdle, `order ${order} to (${tx},${ty}): every unit finished`);
    const far = units.filter((u) => Math.hypot(u.x - goal.x, u.y - goal.y) > 7 * 32).length;
    assert.equal(far, 0, `order ${order} to (${tx},${ty}): ${far} units stranded`);
  }
});
