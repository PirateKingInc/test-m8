// First-run tutorial logic (headless; the DOM panel is covered by e2e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers.js';
import { Tutorial, STEPS } from '../src/game/tutorial.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const fakeUi = (w, ids = []) => ({ selection: { entities: () => ids.map((id) => w.get(id)) } });

test('the tutorial advances as the player does each step, then remembers it is done', () => {
  const storage = memory(), views = [];
  const w = makeWorld({ setup: 'match' });
  const tut = new Tutorial({ storage, render: (v) => views.push(v) });
  assert.equal(tut.active, true);
  assert.equal(views.at(-1).index, 1);
  const drones = [...w.ofKind('unit')].filter((u) => u.team === 1);
  tut.update(w, fakeUi(w));
  assert.equal(tut.step, 0, 'nothing done yet');
  tut.update(w, fakeUi(w, [drones[0].id]));
  assert.equal(STEPS[tut.step].id, 'gather');
  const node = [...w.ofKind('node')].sort((a, b) => a.x - b.x)[0];
  w.issue({ type: 'gather', ids: [drones[0].id], node: node.id });
  tut.update(w, fakeUi(w, [drones[0].id]));
  assert.equal(STEPS[tut.step].id, 'depot');
  w.addBuilding('depot', 1, 14, 22);
  w.addBuilding('foundry', 1, 14, 34, { built: true });
  tut.update(w, fakeUi(w));
  assert.equal(STEPS[tut.step].id, 'train', 'skips past steps already done');
  const s = w.addUnit('striker', 1, 600, 900);
  tut.update(w, fakeUi(w));
  w.issue({ type: 'attackMove', ids: [s.id], x: 2000, y: 900 });
  tut.update(w, fakeUi(w));
  assert.equal(views.at(-1).final, true);
  tut.finish();
  assert.equal(views.at(-1), null);
  assert.equal(new Tutorial({ storage }).active, false, 'not shown again');
  Tutorial.reset(storage);
  assert.equal(new Tutorial({ storage }).active, true, 'reset shows it again');
});

test('the tutorial works when storage is unavailable', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const tut = new Tutorial({ storage: broken });
  assert.equal(tut.active, true);
  assert.doesNotThrow(() => tut.finish());
  assert.doesNotThrow(() => Tutorial.reset(broken));
  assert.equal(new Tutorial({ storage: null }).active, true);
});
