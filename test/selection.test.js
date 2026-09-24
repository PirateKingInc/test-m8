import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, tileCenter, runUntil } from './helpers.js';
import { pickAt, boxSelect, Selection, ControlGroups, formationSlots } from '../src/sim/selection.js';

function setup() {
  const w = emptyWorld();
  const at = (type, tx, ty, team = 1) => { const c = tileCenter(tx, ty); return w.addUnit(type, team, c.x, c.y); };
  const a = at('striker', 2, 2), b = at('striker', 4, 3), c = at('drone', 10, 10), foe = at('dummy', 3, 3, 2);
  const core = w.addBuilding('core', 1, 20, 10, { built: true });
  return { w, a, b, c, foe, core };
}

test('drag-box selects exactly the own units whose centers are inside', () => {
  const { w, a, b, c, foe } = setup();
  const ids = boxSelect(w, 0, 0, 6 * 32, 6 * 32, 1);
  assert.deepEqual(ids.sort(), [a.id, b.id].sort());
  assert.ok(!ids.includes(foe.id), 'enemy/test units are not box-selected');
  assert.ok(!ids.includes(c.id));
  // Corner order does not matter.
  assert.deepEqual(boxSelect(w, 6 * 32, 6 * 32, 0, 0, 1).sort(), ids.sort());
  // Buildings are never box-selected.
  assert.deepEqual(boxSelect(w, 19 * 32, 9 * 32, 25 * 32, 15 * 32, 1), []);
});

test('click-pick prefers units, then buildings, then nothing', () => {
  const { w, a, core } = setup();
  assert.equal(pickAt(w, a.x + 3, a.y - 2).id, a.id);
  assert.equal(pickAt(w, core.x, core.y).id, core.id);
  assert.equal(pickAt(w, 15 * 32, 2 * 32), null);
});

test('selection add/toggle/prune', () => {
  const { w, a, b } = setup();
  const s = new Selection();
  s.set([a.id]);
  s.add([b.id, a.id]);
  assert.deepEqual(s.ids, [a.id, b.id]);
  s.toggle(a.id);
  assert.deepEqual(s.ids, [b.id]);
  b.hp = 0;
  s.prune(w);
  assert.deepEqual(s.ids, []);
});

test('control groups assign, recall and drop dead members', () => {
  const { w, a, b, c } = setup();
  const g = new ControlGroups();
  g.assign(1, [a.id, b.id]);
  g.assign(2, [c.id]);
  assert.deepEqual(g.recall(1, w), [a.id, b.id]);
  assert.deepEqual(g.recall(2, w), [c.id]);
  g.assign(1, [c.id]); // reassign overwrites
  assert.deepEqual(g.recall(1, w), [c.id]);
  w.entities.delete(c.id);
  assert.deepEqual(g.recall(1, w), []);
  assert.deepEqual(g.recall(7, w), []);
});

test('group move gives every unit a distinct walkable destination', () => {
  const w = emptyWorld({ rocks: [[14, 0, 1, 8]] });
  const units = [];
  for (let i = 0; i < 12; i++) units.push(w.addUnit('striker', 1, tileCenter(2 + (i % 4), 2 + Math.floor(i / 4)).x, tileCenter(0, 2 + Math.floor(i / 4)).y));
  const target = tileCenter(14, 4); // on the rock
  const slots = formationSlots(w, units, target.x, target.y);
  const keys = new Set([...slots.values()].map((p) => `${p.x},${p.y}`));
  assert.equal(keys.size, units.length);
  for (const p of slots.values()) {
    const t = w.grid.tileOf(p.x, p.y);
    assert.ok(w.grid.isWalkable(t.tx, t.ty));
  }
  w.issue({ type: 'move', ids: units.map((u) => u.id), ...target });
  runUntil(w, () => units.every((u) => u.order.type === 'idle'), 60);
  for (const u of units) {
    const s = slots.get(u.id);
    assert.ok(Math.hypot(u.x - s.x, u.y - s.y) < 20, 'each unit reached its own slot');
  }
});
