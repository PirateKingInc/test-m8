// Separation steering: overlapping units push apart so groups don't stack or clip.
// Uses a spatial hash, so cost stays ~linear in unit count.
import { tryMove } from './movement.js';

const CELL = 64;
const PAD = 1; // px of breathing room between circles
const PASSES = 2;

// How easily a unit is shoved. Moving units push idle ones out of their way;
// units in melee or working hold their ground more.
function mobility(u) {
  switch (u.order.type) {
    case 'idle': return 1;
    case 'move': case 'attackMove': return u.path ? 0.35 : 1;
    case 'attack': return u.path ? 0.5 : 0.25;
    case 'build': return 0.3;
    default: return 0.5;
  }
}

// Drones working the gather loop pass through each other (a common RTS
// convention) so mining traffic never jams at nodes or depots.
const ghost = (u) => u.order.type === 'gather';

export function separate(world) {
  const units = [];
  for (const u of world.ofKind('unit')) if (!ghost(u)) units.push(u);
  for (let pass = 0; pass < PASSES; pass++) {
    const hash = new Map();
    for (const u of units) {
      const k = `${Math.floor(u.x / CELL)},${Math.floor(u.y / CELL)}`;
      let cell = hash.get(k);
      if (!cell) hash.set(k, (cell = []));
      cell.push(u);
    }
    for (const a of units) {
      const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = hash.get(`${cx + dx},${cy + dy}`);
          if (!cell) continue;
          for (const b of cell) {
            if (b.id <= a.id) continue;
            push(world, a, b);
          }
        }
      }
    }
  }
}

function push(world, a, b) {
  const min = a.radius + b.radius + PAD;
  let nx = b.x - a.x, ny = b.y - a.y;
  const d2 = nx * nx + ny * ny;
  if (d2 >= min * min) return;
  let d = Math.sqrt(d2);
  if (d < 1e-6) { // exactly stacked: split along a direction derived from the ids
    const ang = ((a.id * 7919 + b.id * 104729) % 628) / 100;
    nx = Math.cos(ang); ny = Math.sin(ang); d = 0;
  } else { nx /= d; ny /= d; }
  const overlap = min - d;
  // A mover bumping an idle unit shoves it sideways (off the mover's heading)
  // so it steps aside instead of being bulldozed along the mover's path.
  const aMoving = !!a.path, bMoving = !!b.path;
  if (aMoving !== bMoving) {
    const [m, idle, sign] = aMoving ? [a, b, 1] : [b, a, -1];
    if (idle.order.type === 'idle') {
      const hx = Math.cos(m.facing), hy = Math.sin(m.facing);
      const ox = nx * sign, oy = ny * sign; // mover -> idle
      const side = hx * oy - hy * ox >= 0 ? 1 : -1;
      const px = -hy * side, py = hx * side; // perpendicular, toward the idle unit's side
      tryMove(world, idle, (px * 0.8 + ox * 0.2) * overlap, (py * 0.8 + oy * 0.2) * overlap);
      return;
    }
  }
  // Two movers meeting roughly head-on both sidestep to their own right,
  // so opposing streams flow past each other instead of deadlocking.
  if (aMoving && bMoving) {
    const ahx = Math.cos(a.facing), ahy = Math.sin(a.facing);
    const bhx = Math.cos(b.facing), bhy = Math.sin(b.facing);
    if (ahx * bhx + ahy * bhy < -0.3) {
      const k = overlap * 0.5;
      tryMove(world, a, (-ahy * 0.7 - nx * 0.3) * k, (ahx * 0.7 - ny * 0.3) * k);
      tryMove(world, b, (-bhy * 0.7 + nx * 0.3) * k, (bhx * 0.7 + ny * 0.3) * k);
      return;
    }
  }
  // Moving units only partially resolve overlap with each other (soft
  // collisions): crowds compress a little and keep flowing through
  // chokepoints instead of locking up. Once they stop, full separation applies.
  const soft = aMoving && bMoving ? 0.25 : 1;
  const ma = mobility(a), mb = mobility(b), sum = ma + mb;
  const pa = (overlap * soft * ma) / sum, pb = (overlap * soft * mb) / sum;
  tryMove(world, a, -nx * pa, -ny * pa);
  tryMove(world, b, nx * pb, ny * pb);
}
