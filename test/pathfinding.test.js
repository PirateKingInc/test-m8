import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, emptyWorld, tileCenter, runUntil } from './helpers.js';

function spawn(world, type, tx, ty, team = 1) {
  const c = tileCenter(tx, ty);
  return world.addUnit(type, team, c.x, c.y);
}

function trackBlockedVisits(world, u) {
  let hits = 0;
  const orig = world.step.bind(world);
  world.step = () => {
    orig();
    const t = world.grid.tileOf(u.x, u.y);
    if (!world.grid.isWalkable(t.tx, t.ty)) hits++;
  };
  return () => hits;
}

test('unit routes around a wall and arrives at its exact destination', () => {
  const w = emptyWorld({ rocks: [[10, 0, 2, 16]] });
  const u = spawn(w, 'striker', 5, 5);
  const blocked = trackBlockedVisits(w, u);
  const goal = tileCenter(18, 5);
  w.issue({ type: 'move', ids: [u.id], x: goal.x + 5, y: goal.y - 3 });
  assert.ok(u.path.length >= 2, 'path must bend around the wall');
  assert.ok(u.path.some((p) => p.y > 16 * 32), 'route goes below the wall');
  const t = runUntil(w, () => u.order.type === 'idle', 60);
  assert.ok(t < 60, 'arrived');
  assert.ok(Math.hypot(u.x - (goal.x + 5), u.y - (goal.y - 3)) < 3);
  assert.equal(blocked(), 0, 'never stood on a blocked tile');
});

test('unit routes around a building placed in its way', () => {
  const w = emptyWorld();
  w.addBuilding('foundry', 1, 9, 3, { built: true });
  const u = spawn(w, 'drone', 5, 4);
  const blocked = trackBlockedVisits(w, u);
  const goal = tileCenter(16, 4);
  w.issue({ type: 'move', ids: [u.id], ...goal });
  runUntil(w, () => u.order.type === 'idle', 30);
  assert.ok(Math.hypot(u.x - goal.x, u.y - goal.y) < 3);
  assert.equal(blocked(), 0);
});

test('move onto a blocked tile ends on the nearest walkable tile', () => {
  const w = emptyWorld({ rocks: [[14, 8, 3, 3]] });
  const u = spawn(w, 'striker', 3, 9);
  const target = tileCenter(15, 9); // middle of the rock
  w.issue({ type: 'move', ids: [u.id], ...target });
  runUntil(w, () => u.order.type === 'idle', 30);
  const t = w.grid.tileOf(u.x, u.y);
  assert.ok(w.grid.isWalkable(t.tx, t.ty));
  assert.ok(Math.max(Math.abs(t.tx - 15), Math.abs(t.ty - 9)) <= 2, `ended at ${t.tx},${t.ty}`);
});

test('unreachable goal (walled-in pocket) routes to the closest reachable tile', () => {
  const w = emptyWorld({ rocks: [[20, 5, 6, 1], [20, 10, 6, 1], [20, 5, 1, 6], [25, 5, 1, 6]] });
  const u = spawn(w, 'striker', 3, 7);
  w.issue({ type: 'move', ids: [u.id], ...tileCenter(22, 7) });
  const t = runUntil(w, () => u.order.type === 'idle', 30);
  assert.ok(t < 30);
  const tile = w.grid.tileOf(u.x, u.y);
  assert.equal(tile.tx, 19, 'stops just outside the pocket wall');
});

test('a unit that gets boxed in gives up instead of staying stuck forever', () => {
  const w = emptyWorld();
  const u = spawn(w, 'striker', 5, 5);
  w.issue({ type: 'move', ids: [u.id], ...tileCenter(25, 5) });
  w.run(0.5);
  const here = w.grid.tileOf(u.x, u.y);
  // Wall the unit into its current tile after it started moving.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) w.grid.setRock(here.tx + dx, here.ty + dy, 1, 1);
  }
  const t = runUntil(w, () => u.order.type === 'idle', 20);
  assert.ok(t < 10, `gave up after ${t}s`);
  assert.equal(u.path, null);
});

test('on the real map a drone crosses both ridges through the chokepoints', () => {
  const w = makeWorld();
  const drone = [...w.ofKind('unit')][0];
  const blocked = trackBlockedVisits(w, drone);
  const goal = tileCenter(75, 30);
  w.issue({ type: 'move', ids: [drone.id], ...goal });
  const t = runUntil(w, () => drone.order.type === 'idle', 120);
  assert.ok(t < 120, 'arrived');
  assert.ok(Math.hypot(drone.x - goal.x, drone.y - goal.y) < 3);
  assert.equal(blocked(), 0);
  // Straight-line distance is ~62 tiles; the detour through chokepoints must not be absurd.
  assert.ok(t < (62 * 32 * 1.5) / 72, `took ${t.toFixed(1)}s`);
});
