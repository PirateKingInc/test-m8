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
  return u.path.length > 0;
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
