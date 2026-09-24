import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, tileCenter, runUntil } from './helpers.js';
import { UNITS } from '../src/data/units.js';

function base() {
  const w = emptyWorld();
  const core = w.addBuilding('core', 1, 4, 4, { built: true });
  const foundry = w.addBuilding('foundry', 1, 14, 4, { built: true });
  const trained = [];
  const origEmit = w.emit.bind(w);
  w.emit = (type, data) => { if (type === 'trained') trained.push(data.unit); origEmit(type, data); };
  return { w, core, foundry, trained };
}

test('queueing deducts the cost immediately and rejects when short', () => {
  const { w, foundry } = base();
  w.resources[1] = 200;
  assert.equal(w.issue({ type: 'train', building: foundry.id, unit: 'bulwark' }).ok, true);
  assert.equal(w.resources[1], 50);
  const res = w.issue({ type: 'train', building: foundry.id, unit: 'striker' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'Not enough Lumen');
  assert.equal(foundry.queue.length, 1);
});

test('units train in FIFO order with the spec train times', () => {
  const { w, foundry, trained } = base();
  w.resources[1] = 1000;
  for (const unit of ['sparker', 'striker', 'lancer']) w.issue({ type: 'train', building: foundry.id, unit });
  const t0 = w.time;
  const times = [];
  runUntil(w, () => { if (trained.length > times.length) times.push(w.time - t0); return trained.length === 3; }, 120);
  assert.deepEqual(trained, ['sparker', 'striker', 'lancer']);
  const expected = [14, 14 + 12, 14 + 12 + 18];
  times.forEach((t, i) => assert.ok(Math.abs(t - expected[i]) < 0.11, `item ${i} done at ${t}, expected ${expected[i]}`));
});

test('cancel refunds 100% for queued and in-progress items', () => {
  const { w, foundry, trained } = base();
  w.resources[1] = 1000;
  for (const unit of ['striker', 'sparker', 'bulwark']) w.issue({ type: 'train', building: foundry.id, unit });
  assert.equal(w.resources[1], 1000 - 60 - 70 - 150);
  w.run(5); // striker is in progress
  assert.equal(w.issue({ type: 'cancelTrain', building: foundry.id, index: 1 }).refund, 70);
  assert.equal(w.issue({ type: 'cancelTrain', building: foundry.id, index: 0 }).refund, 60);
  assert.equal(w.resources[1], 1000 - 150);
  assert.deepEqual(foundry.queue.map((q) => q.unit), ['bulwark']);
  assert.equal(foundry.queue[0].progress, 0, 'next item starts fresh');
  assert.equal(w.issue({ type: 'cancelTrain', building: foundry.id }).refund, 150); // default: last
  assert.equal(w.resources[1], 1000);
  w.run(30);
  assert.deepEqual(trained, []);
});

test('queue holds at most 5 items; buildings only train their own roster', () => {
  const { w, core, foundry } = base();
  w.resources[1] = 5000;
  for (let i = 0; i < 5; i++) assert.equal(w.issue({ type: 'train', building: core.id, unit: 'drone' }).ok, true);
  assert.equal(w.issue({ type: 'train', building: core.id, unit: 'drone' }).reason, 'Queue is full');
  assert.equal(w.issue({ type: 'train', building: core.id, unit: 'striker' }).ok, false);
  assert.equal(w.issue({ type: 'train', building: foundry.id, unit: 'drone' }).ok, false);
  const site = w.addBuilding('foundry', 1, 20, 12);
  assert.equal(w.issue({ type: 'train', building: site.id, unit: 'striker' }).ok, false, 'unfinished buildings cannot train');
  assert.equal(w.resources[1], 5000 - 5 * UNITS.drone.cost);
});

test('trained units spawn on distinct free tiles even when the exit is crowded, then go to the rally point', () => {
  const { w, core } = base();
  w.resources[1] = 5000;
  // Crowd every tile around the core.
  for (let ty = 3; ty <= 8; ty++) for (let tx = 3; tx <= 8; tx++) {
    if (w.grid.isWalkable(tx, ty)) w.addUnit('striker', 1, tileCenter(tx, ty).x, tileCenter(tx, ty).y);
  }
  for (let i = 0; i < 3; i++) w.issue({ type: 'train', building: core.id, unit: 'drone' });
  runUntil(w, () => core.queue.length === 0, 60);
  const drones = [...w.ofKind('unit')].filter((u) => u.type === 'drone');
  assert.equal(drones.length, 3);
  for (const d of drones) {
    const t = w.grid.tileOf(d.x, d.y);
    assert.ok(w.grid.isWalkable(t.tx, t.ty));
  }
  const rally = tileCenter(20, 16);
  w.issue({ type: 'rally', building: core.id, ...rally });
  w.issue({ type: 'train', building: core.id, unit: 'drone' });
  runUntil(w, () => [...w.ofKind('unit')].filter((u) => u.type === 'drone').length === 4, 20);
  const newest = [...w.ofKind('unit')].filter((u) => u.type === 'drone').pop();
  assert.equal(newest.order.type, 'move');
  runUntil(w, () => newest.order.type === 'idle', 30);
  assert.ok(Math.hypot(newest.x - rally.x, newest.y - rally.y) < 3);
});

test('every Foundry unit can be trained and then moved', () => {
  const { w, foundry } = base();
  w.resources[1] = 1000;
  for (const unit of ['striker', 'sparker', 'bulwark', 'lancer']) w.issue({ type: 'train', building: foundry.id, unit });
  runUntil(w, () => foundry.queue.length === 0, 120);
  const units = [...w.ofKind('unit')];
  assert.deepEqual(units.map((u) => u.type).sort(), ['bulwark', 'lancer', 'sparker', 'striker']);
  const goal = tileCenter(24, 15);
  w.issue({ type: 'move', ids: units.map((u) => u.id), ...goal });
  runUntil(w, () => units.every((u) => u.order.type === 'idle'), 60);
  for (const u of units) assert.ok(Math.hypot(u.x - goal.x, u.y - goal.y) < 80, `${u.type} arrived near the goal`);
});
