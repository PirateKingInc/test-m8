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

// Distinct destination points for a group move. The group keeps its shape:
// each unit aims at goal + (its offset from the group centroid), with the
// offsets compressed if the group is spread out, then snaps to the nearest
// free walkable tile. Translating the formation means paths rarely cross, so
// early arrivals aren't shoved around by units heading to slots behind them.
export function formationSlots(world, units, x, y) {
  const g = world.grid, T = g.tile;
  const cx = units.reduce((s, u) => s + u.x, 0) / units.length;
  const cy = units.reduce((s, u) => s + u.y, 0) / units.length;
  const spread = Math.max(...units.map((u) => Math.hypot(u.x - cx, u.y - cy)), 1);
  const maxSpread = T * Math.ceil(Math.sqrt(units.length)) * 0.75;
  const k = Math.min(1, maxSpread / spread);
  const wanted = units.map((u) => ({ u, x: x + (u.x - cx) * k, y: y + (u.y - cy) * k }));
  wanted.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const used = new Set(), out = new Map();
  for (const w of wanted) {
    const t = g.tileOf(w.x, w.y);
    const start = g.inBounds(t.tx, t.ty) ? t : g.tileOf(x, y);
    let slot = null;
    for (const c of g.spiral(start.tx, start.ty, 16)) {
      const key = c.ty * g.cols + c.tx;
      if (!used.has(key)) { used.add(key); slot = g.center(c.tx, c.ty); break; }
    }
    out.set(w.u.id, slot || { x, y });
  }
  return out;
}
