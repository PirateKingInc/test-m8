// Command handling (the only way the UI, tests or a future AI change the world)
// and the per-unit order state machine.
import { setDestination, followPath, clearPath, tryMove } from './movement.js';
import { formationSlots } from './selection.js';

const handlers = {
  move(world, cmd) {
    const units = ownUnits(world, cmd);
    const slots = units.length > 1 ? formationSlots(world, units, cmd.x, cmd.y) : null;
    for (const u of units) {
      const p = slots ? slots.get(u.id) : cmd;
      u.order = { type: 'move', x: p.x, y: p.y };
      setDestination(world, u, p.x, p.y);
    }
    return { ok: units.length > 0 };
  },

  stop(world, cmd) {
    const units = ownUnits(world, cmd);
    for (const u of units) { u.order = { type: 'idle' }; clearPath(u); }
    return { ok: units.length > 0 };
  },
};

export function registerCommand(type, fn) {
  handlers[type] = fn;
}

export function issueCommand(world, cmd) {
  const h = handlers[cmd.type];
  if (!h) return { ok: false, reason: `unknown command ${cmd.type}` };
  const res = h(world, cmd) || { ok: true };
  if (!res.ok && res.reason) world.emit('rejected', { reason: res.reason, team: cmd.team ?? 1 });
  return res;
}

// Units in cmd.ids that belong to cmd.team (default: player) and are alive.
export function ownUnits(world, cmd) {
  const team = cmd.team ?? 1;
  const out = [];
  for (const id of cmd.ids || []) {
    const e = world.get(id);
    if (e && e.kind === 'unit' && e.team === team && e.hp > 0) out.push(e);
  }
  return out;
}

const ANCHOR_SLACK = 4; // px an idle unit may be nudged before drifting back
const ANCHOR_MAX = 96; // pushed further than this: accept the new spot
const ANCHOR_PATIENCE = 2; // s without progress before giving up the anchor

// Where a unit settled after a move. Idle units that get shoved a little by
// passing traffic drift back, so formations keep their shape.
export function setAnchor(u) {
  u.anchor = { x: u.x, y: u.y, best: 0, t: 0 };
}

function driftHome(world, u, dt) {
  const a = u.anchor;
  if (!a) return;
  const d = Math.hypot(a.x - u.x, a.y - u.y);
  if (d <= ANCHOR_SLACK) { a.t = 0; a.best = d; return; }
  if (d > ANCHOR_MAX) { u.anchor = null; return; }
  if (a.t === 0 || d < a.best - 0.5) { a.best = d; a.t = dt; } else a.t += dt;
  if (a.t > ANCHOR_PATIENCE) { u.anchor = null; return; }
  const step = Math.min(d, u.speed * 0.5 * dt);
  tryMove(world, u, ((a.x - u.x) / d) * step, ((a.y - u.y) / d) * step);
}

const thinkers = {
  idle: driftHome,
  move(world, u, dt) {
    const r = followPath(world, u, dt);
    if (r !== 'moving') { u.order = { type: 'idle' }; setAnchor(u); }
  },
};

export function registerOrder(type, fn) {
  thinkers[type] = fn;
}

export function thinkUnit(world, u, dt) {
  (thinkers[u.order.type] || thinkers.idle)(world, u, dt);
}
