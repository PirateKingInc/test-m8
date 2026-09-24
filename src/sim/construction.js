// Building placement and construction (SPEC.md "Buildings").
import { BUILDINGS, CONSTRUCTION } from '../data/buildings.js';
import { registerCommand, registerOrder, ownUnits } from './orders.js';
import { gap } from './geometry.js';
import { approach, canStand, clearPath } from './movement.js';

export function canPlace(world, type, tx, ty) {
  const def = BUILDINGS[type];
  return !!def && world.grid.isRectFree(tx, ty, def.w, def.h);
}

// Push units standing on a freshly blocked footprint to the nearest free tile.
function evictUnits(world, b) {
  for (const u of world.ofKind('unit')) {
    if (canStand(world.grid, u.x, u.y, u.radius)) continue;
    const here = world.grid.tileOf(u.x, u.y);
    const free = world.grid.nearestWalkable(here.tx, here.ty, 8);
    if (!free) continue;
    const c = world.grid.center(free.tx, free.ty);
    u.x = u.px = c.x; u.y = u.py = c.y;
    if (u.order.type === 'move') clearPath(u), (u.order = { type: 'idle' });
  }
  world.emit('placed', { id: b.id });
}

registerCommand('build', (world, cmd) => {
  const team = cmd.team ?? 1;
  const drones = ownUnits(world, cmd).filter((u) => u.type === 'drone');
  const def = BUILDINGS[cmd.building];
  if (!drones.length || !def) return { ok: false, reason: 'Select a Drone to build' };
  if (!canPlace(world, cmd.building, cmd.tx, cmd.ty)) return { ok: false, reason: "Can't build there" };
  if (world.resources[team] < def.cost) return { ok: false, reason: 'Not enough Lumen' };
  world.resources[team] -= def.cost;
  const b = world.addBuilding(cmd.building, team, cmd.tx, cmd.ty);
  b.hp = def.hp * CONSTRUCTION.startHpFraction;
  evictUnits(world, b);
  // The nearest selected Drone takes the job.
  const builder = drones.reduce((best, u) => (gap(u, b) < gap(best, b) ? u : best));
  builder.order = { type: 'build', target: b.id };
  clearPath(builder);
  return { ok: true, id: b.id };
});

registerCommand('assist', (world, cmd) => {
  const b = world.get(cmd.target);
  const drones = ownUnits(world, cmd).filter((u) => u.type === 'drone');
  if (!b || b.kind !== 'building' || b.built || b.team !== (cmd.team ?? 1) || !drones.length) return { ok: false };
  for (const u of drones) { u.order = { type: 'build', target: b.id }; clearPath(u); }
  return { ok: true };
});

registerCommand('cancelBuild', (world, cmd) => {
  const b = world.get(cmd.id);
  if (!b || b.kind !== 'building' || b.built || b.team !== (cmd.team ?? 1)) return { ok: false };
  const refund = Math.floor(BUILDINGS[b.type].cost * CONSTRUCTION.cancelRefund);
  world.resources[b.team] += refund;
  world.removeEntity(b);
  world.emit('cancelled', { id: b.id, refund });
  return { ok: true, refund };
});

registerOrder('build', (world, u, dt) => {
  const b = world.get(u.order.target);
  if (!b || b.built || b.hp <= 0) { u.order = { type: 'idle' }; clearPath(u); return; }
  if (gap(u, b) <= CONSTRUCTION.builderRange) {
    clearPath(u);
    b.buildingNow = true;
    return;
  }
  approach(world, u, b, dt);
});

// Advance every site that had a builder next to it this tick.
export function updateConstruction(world, dt) {
  for (const b of world.ofKind('building')) {
    if (b.built) continue;
    if (b.buildingNow) {
      const def = BUILDINGS[b.type];
      const k = dt / def.buildTime;
      b.progress = Math.min(1, b.progress + k);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * (1 - CONSTRUCTION.startHpFraction) * k);
      if (b.progress >= 1) {
        b.built = true;
        world.emit('built', { id: b.id, building: b.type, team: b.team });
      }
    }
    b.buildingNow = false;
  }
}
