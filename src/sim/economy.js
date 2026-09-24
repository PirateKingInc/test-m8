// Resource gathering loop (SPEC.md "Resources"): node -> nearest Depot -> node.
import { registerCommand, registerOrder, ownUnits } from './orders.js';
import { approach, clearPath } from './movement.js';
import { gap } from './geometry.js';
import { BUILDINGS } from '../data/buildings.js';

export const GATHER = {
  carry: 8,
  mineTime: 2.0,
  reach: 8, // px gap to mine or drop off
  retargetTiles: 12, // an empty node's Drones look this far for a new node
};

export function nearestDepot(world, u) {
  let best = null, bestD = Infinity;
  for (const b of world.ofKind('building')) {
    if (b.team !== u.team || !b.built || !BUILDINGS[b.type].dropOff) continue;
    const d = gap(u, b);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function nearestNode(world, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const n of world.ofKind('node')) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestD) { bestD = d; best = n; }
  }
  return best;
}

function startGather(u, node, phase) {
  u.order = { type: 'gather', node: node.id, nx: node.x, ny: node.y, phase, timer: 0 };
  clearPath(u);
}

registerCommand('gather', (world, cmd) => {
  const node = world.get(cmd.node);
  const drones = ownUnits(world, cmd).filter((u) => u.type === 'drone');
  if (!node || node.kind !== 'node' || !drones.length) return { ok: false };
  for (const u of drones) startGather(u, node, u.carry > 0 ? 'toDepot' : 'toNode');
  return { ok: true };
});

registerCommand('returnCargo', (world, cmd) => {
  const drones = ownUnits(world, cmd).filter((u) => u.type === 'drone' && u.carry > 0);
  for (const u of drones) {
    const prev = u.order.type === 'gather' ? u.order : null;
    u.order = { type: 'gather', node: prev?.node ?? 0, nx: prev?.nx ?? u.x, ny: prev?.ny ?? u.y, phase: 'toDepot', timer: 0 };
    clearPath(u);
  }
  return { ok: drones.length > 0 };
});

registerOrder('gather', (world, u, dt) => {
  const o = u.order;
  if (o.phase === 'toDepot') {
    const depot = nearestDepot(world, u);
    if (!depot) { clearPath(u); return; } // hold the cargo until a Depot exists
    if (gap(u, depot) <= GATHER.reach) {
      clearPath(u);
      world.resources[u.team] += u.carry;
      world.emit('dropoff', { id: u.id, amount: u.carry, team: u.team, x: u.x, y: u.y });
      u.carry = 0;
      o.phase = 'toNode';
      return;
    }
    approach(world, u, depot, dt);
    return;
  }

  let node = world.get(o.node);
  if (!node || node.amount <= 0) {
    node = nearestNode(world, o.nx, o.ny, GATHER.retargetTiles * world.grid.tile);
    if (!node) { u.order = { type: 'idle' }; clearPath(u); return; }
    Object.assign(o, { node: node.id, nx: node.x, ny: node.y, phase: 'toNode', timer: 0 });
    clearPath(u);
  }
  if (o.phase === 'toNode') {
    if (gap(u, node) <= GATHER.reach) { clearPath(u); o.phase = 'mining'; o.timer = 0; }
    else approach(world, u, node, dt);
    return;
  }
  // mining
  o.timer += dt;
  u.facing = Math.atan2(node.y - u.y, node.x - u.x);
  if (o.timer + 1e-9 < GATHER.mineTime) return;
  const take = Math.min(GATHER.carry, node.amount);
  node.amount -= take;
  u.carry = take;
  o.phase = 'toDepot';
  if (node.amount <= 0) {
    world.removeEntity(node);
    world.emit('depleted', { id: node.id, x: node.x, y: node.y });
  }
});
