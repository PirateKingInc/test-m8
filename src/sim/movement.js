// Path following, stuck recovery and wall sliding. Pure sim code.
const ARRIVE = 2; // px
const STUCK_WINDOW = 1.0; // s
const STUCK_MIN_PROGRESS = 4; // px per window
const MAX_REPATHS = 3;

// Give the unit a new destination. Returns false if no route exists.
export function setDestination(world, u, x, y) {
  const path = world.pathfinder.find(u.x, u.y, x, y);
  u.dest = { x, y };
  u.path = path || [];
  u.pathIdx = 0;
  u.stuck = { t: 0, x: u.x, y: u.y, repaths: 0 };
  u.pathVersion = world.grid.version;
  return u.path.length > 0;
}

// Walk toward the free tile next to entity e that is closest to the unit.
export function approach(world, u, e, dt) {
  if (!u.path || u.approachTarget !== e.id) {
    const t = adjacentTile(world, e, u.x, u.y);
    if (!t) return 'failed';
    setDestination(world, u, t.x, t.y);
    u.approachTarget = e.id;
  }
  const r = followPath(world, u, dt);
  if (r !== 'moving') u.approachTarget = null; // arrived or failed: re-plan next tick if still out of range
  return r;
}

// Center of the walkable tile bordering e's footprint that is nearest to (x,y).
// Edge-adjacent tiles come first: diagonal corner tiles are too far from the edge
// for melee/build range, so they are only used when every edge tile is blocked.
export function adjacentTile(world, e, x, y) {
  const g = world.grid;
  let best = null, bestD = Infinity;
  for (const corners of [false, true]) {
    for (let ty = e.ty - 1; ty <= e.ty + e.h; ty++) {
      for (let tx = e.tx - 1; tx <= e.tx + e.w; tx++) {
        const sideX = tx === e.tx - 1 || tx === e.tx + e.w, sideY = ty === e.ty - 1 || ty === e.ty + e.h;
        if (!(sideX || sideY) || (sideX && sideY) !== corners || !g.isWalkable(tx, ty)) continue;
        const c = g.center(tx, ty), d = Math.hypot(c.x - x, c.y - y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    if (best) return best;
  }
  return null;
}

export function clearPath(u) {
  u.path = null;
  u.dest = null;
}

// A unit's circle may stand here if the tiles under its (shrunken) footprint are walkable.
export function canStand(grid, x, y, r) {
  const k = Math.min(r, 10) * 0.6;
  for (const [ox, oy] of [[0, 0], [-k, -k], [k, -k], [-k, k], [k, k]]) {
    const t = grid.tileOf(x + ox, y + oy);
    if (!grid.isWalkable(t.tx, t.ty)) return false;
  }
  return true;
}

// Move by (dx,dy), sliding along walls when the full move is blocked.
export function tryMove(world, u, dx, dy) {
  const g = world.grid;
  const nx = Math.min(Math.max(u.x + dx, u.radius), world.width - u.radius);
  const ny = Math.min(Math.max(u.y + dy, u.radius), world.height - u.radius);
  if (canStand(g, nx, ny, u.radius)) { u.x = nx; u.y = ny; return true; }
  if (canStand(g, nx, u.y, u.radius)) { u.x = nx; return true; }
  if (canStand(g, u.x, ny, u.radius)) { u.y = ny; return true; }
  return false;
}

// Advance along the path. Returns 'moving', 'arrived' or 'failed'.
export function followPath(world, u, dt) {
  if (!u.path) return 'arrived';
  // The map changed (building placed or removed): re-route once.
  if (u.pathVersion !== world.grid.version && u.dest) {
    const stuck = u.stuck;
    setDestination(world, u, u.dest.x, u.dest.y);
    u.stuck = stuck;
  }
  let budget = u.speed * dt;
  while (budget > 0 && u.pathIdx < u.path.length) {
    const wp = u.path[u.pathIdx];
    const dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy);
    if (d <= Math.max(ARRIVE, budget)) {
      if (!tryMove(world, u, dx, dy)) break;
      budget -= d;
      u.pathIdx++;
    } else {
      u.facing = Math.atan2(dy, dx);
      tryMove(world, u, (dx / d) * budget, (dy / d) * budget);
      budget = 0;
    }
  }
  if (u.pathIdx >= u.path.length) { clearPath(u); return 'arrived'; }
  return checkStuck(world, u, dt);
}

function checkStuck(world, u, dt) {
  const s = u.stuck;
  s.t += dt;
  if (s.t < STUCK_WINDOW) return 'moving';
  const progress = Math.hypot(u.x - s.x, u.y - s.y);
  s.t = 0; s.x = u.x; s.y = u.y;
  if (progress >= STUCK_MIN_PROGRESS) { s.repaths = 0; return 'moving'; }
  if (s.repaths >= MAX_REPATHS) { clearPath(u); return 'failed'; }
  const repaths = s.repaths + 1;
  const dest = u.dest;
  setDestination(world, u, dest.x, dest.y);
  u.stuck.repaths = repaths;
  if (u.path.length === 0) { clearPath(u); return 'failed'; }
  return 'moving';
}
