import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, tileCenter, runUntil } from './helpers.js';

const at = (w, type, tx, ty, team = 1) => { const c = tileCenter(tx, ty); return w.addUnit(type, team, c.x, c.y); };

test('attack-move engages test targets in range en route, then continues to the destination', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const squad = [at(w, 'striker', 2, 9), at(w, 'sparker', 2, 11)];
  const nearPath = [at(w, 'dummy', 18, 7, 2), at(w, 'dummy', 20, 13, 2)];
  const farAway = at(w, 'dummy', 20, 1, 2); // > 200 px gap from the route: ignored
  const goal = tileCenter(36, 10);
  w.issue({ type: 'attackMove', ids: squad.map((u) => u.id), ...goal });
  runUntil(w, () => squad.every((u) => u.order.type === 'idle'), 120);
  for (const d of nearPath) assert.equal(w.get(d.id), undefined, 'test target near the route destroyed');
  assert.ok(w.get(farAway.id), 'distant test target left alone');
  for (const u of squad) assert.ok(Math.hypot(u.x - goal.x, u.y - goal.y) < 70, `${u.type} reached the destination`);
});

test('plain move ignores enemies; right-click attack targets one specifically', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const s = at(w, 'striker', 2, 10);
  const d = at(w, 'dummy', 12, 11, 2);
  w.issue({ type: 'move', ids: [s.id], ...tileCenter(30, 10) });
  runUntil(w, () => s.order.type === 'idle', 60);
  assert.equal(d.hp, 300, 'moving units do not stop to fight');
  w.issue({ type: 'attack', ids: [s.id], target: d.id });
  runUntil(w, () => !w.get(d.id), 60);
  w.step();
  assert.equal(s.order.type, 'idle');
});

test('idle combat units auto-acquire within 200 px; drones never auto-acquire', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const s = at(w, 'striker', 5, 10), dr = at(w, 'drone', 5, 14);
  const near = at(w, 'dummy', 10, 10, 2); // ~136 px gap from the striker
  const nearDrone = at(w, 'dummy', 6, 16, 2);
  w.run(1);
  assert.equal(s.order.type, 'attack');
  assert.equal(s.order.target, near.id);
  assert.equal(dr.order.type, 'idle');
  assert.equal(nearDrone.hp, 300);
  w.issue({ type: 'attack', ids: [dr.id], target: nearDrone.id }); // but drones fight when ordered
  runUntil(w, () => nearDrone.hp < 300, 10);
});

test('auto-chase is abandoned beyond the 320 px leash', () => {
  const w = emptyWorld({ cols: 60, rows: 20 });
  const s = at(w, 'striker', 5, 10);
  const foe = at(w, 'striker', 10, 10, 2);
  w.run(0.5);
  assert.equal(s.order.type, 'attack');
  foe.x += 400; foe.px = foe.x; // teleport out of leash range
  foe.order = { type: 'idle' };
  w.step();
  assert.equal(s.order.type, 'idle');
});

test('an idle unit shot from beyond its aggro range fights back', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const victim = at(w, 'bulwark', 5, 10);
  const shooter = at(w, 'sparker', 12, 10, 2);
  shooter.order = { type: 'attack', target: victim.id };
  runUntil(w, () => victim.hp < 300, 5);
  w.step();
  assert.equal(victim.order.type, 'attack');
  assert.equal(victim.order.target, shooter.id);
});

test('the Sentry Spire shoots enemies in range once built, and not before', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const spire = w.addBuilding('spire', 1, 10, 9);
  const d = at(w, 'dummy', 15, 10, 2);
  w.run(3);
  assert.equal(d.hp, 300, 'unfinished spire is inert');
  spire.built = true;
  runUntil(w, () => !w.get(d.id), 60);
  const far = at(w, 'dummy', 30, 10, 2);
  w.run(5);
  assert.equal(far.hp, 300, 'out of 224 px range');
});

test('destroyed buildings free their tiles and emit a death event', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const b = w.addBuilding('depot', 2, 10, 8, { built: true });
  const squad = ['bulwark', 'lancer', 'striker'].map((t, i) => at(w, t, 5, 8 + i));
  w.issue({ type: 'attack', ids: squad.map((u) => u.id), target: b.id });
  runUntil(w, () => !w.get(b.id), 120);
  assert.equal(w.grid.isWalkable(11, 9), true);
  assert.ok(w.drainEvents().some((e) => e.type === 'death' && e.id === b.id));
});

test('damage follows the multiplier table within the +/-10% roll', () => {
  const w = emptyWorld({ cols: 40, rows: 20 });
  const lancer = at(w, 'lancer', 5, 10);
  const bul = at(w, 'bulwark', 8, 10, 2);
  bul.order = { type: 'move', x: bul.x, y: bul.y }; // hold still, don't fight back
  w.issue({ type: 'attack', ids: [lancer.id], target: bul.id });
  runUntil(w, () => bul.hp < 300, 5);
  const dealt = 300 - bul.hp;
  assert.ok(dealt >= 26 * 2.5 * 0.9 - 1e-9 && dealt <= 26 * 2.5 * 1.1 + 1e-9, `dealt ${dealt}`);
});
