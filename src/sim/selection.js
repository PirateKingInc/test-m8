// Pure selection helpers used by the input layer (and tests).
import { rectOf } from './geometry.js';

// Topmost entity under a world point: units first, then buildings, then crystal nodes.
export function pickAt(world, x, y, slack = 4) {
  let best = null, bestD = Infinity;
  for (const u of world.ofKind('unit')) {
    const d = Math.hypot(u.x - x, u.y - y);
    if (d <= u.radius + slack && d < bestD) { best = u; bestD = d; }
  }
  if (best) return best;
  for (const kind of ['building', 'node']) {
    for (const e of world.ofKind(kind)) {
      const r = rectOf(e);
      if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) return e;
    }
  }
  return null;
}

// Ids of `team`'s units whose centers lie inside the (unordered) box corners.
export function boxSelect(world, x1, y1, x2, y2, team = 1) {
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const ids = [];
  for (const u of world.ofKind('unit')) {
    if (u.team === team && u.x >= l && u.x <= r && u.y >= t && u.y <= b) ids.push(u.id);
  }
  return ids;
}

export class Selection {
  constructor() { this.ids = []; }
  set(ids) { this.ids = [...new Set(ids)]; }
  add(ids) { this.set([...this.ids, ...ids]); }
  toggle(id) { this.ids = this.ids.includes(id) ? this.ids.filter((i) => i !== id) : [...this.ids, id]; }
  clear() { this.ids = []; }
  has(id) { return this.ids.includes(id); }
  prune(world) { this.ids = this.ids.filter((id) => world.get(id)?.hp > 0 || world.get(id)?.kind === 'node'); }
  entities(world) { this.prune(world); return this.ids.map((id) => world.get(id)); }
}

// Control groups 1-9. Recall drops members that have died since assignment.
export class ControlGroups {
  constructor() { this.groups = new Map(); }
  assign(n, ids) { this.groups.set(n, [...ids]); }
  recall(n, world) {
    const alive = (this.groups.get(n) || []).filter((id) => world.get(id)?.hp > 0);
    this.groups.set(n, alive);
    return alive;
  }
}

// Distinct destination points for a group move: a spiral of walkable tiles
// around the target, matched to units greedily by distance (shortest pairs first).
export function formationSlots(world, units, x, y) {
  const g = world.grid, goal = g.tileOf(x, y);
  const slots = [];
  for (const t of g.spiral(goal.tx, goal.ty, 12)) {
    slots.push(g.center(t.tx, t.ty));
    if (slots.length >= units.length) break;
  }
  const pairs = [];
  units.forEach((u, ui) => slots.forEach((s, si) => pairs.push([Math.hypot(u.x - s.x, u.y - s.y), ui, si])));
  pairs.sort((a, b) => a[0] - b[0]);
  const out = new Map(), usedSlot = new Set();
  for (const [, ui, si] of pairs) {
    const u = units[ui];
    if (out.has(u.id) || usedSlot.has(si)) continue;
    out.set(u.id, slots[si]);
    usedSlot.add(si);
  }
  for (const u of units) if (!out.has(u.id)) out.set(u.id, { x, y }); // more units than free tiles
  return out;
}
