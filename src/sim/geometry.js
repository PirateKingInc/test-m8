// Footprint geometry. Units are circles (x, y, radius); buildings and nodes are
// axis-aligned rects in px (left, top, right, bottom). "Gap" is edge-to-edge distance.

export function rectOf(e) {
  return { l: e.x - e.pw / 2, t: e.y - e.ph / 2, r: e.x + e.pw / 2, b: e.y + e.ph / 2 };
}

function pointRectDist(x, y, rc) {
  const dx = Math.max(rc.l - x, 0, x - rc.r);
  const dy = Math.max(rc.t - y, 0, y - rc.b);
  return Math.hypot(dx, dy);
}

export function gap(a, b) {
  const aCircle = a.kind === 'unit';
  const bCircle = b.kind === 'unit';
  if (aCircle && bCircle) return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
  if (aCircle) return pointRectDist(a.x, a.y, rectOf(b)) - a.radius;
  if (bCircle) return pointRectDist(b.x, b.y, rectOf(a)) - b.radius;
  const ra = rectOf(a), rb = rectOf(b);
  const dx = Math.max(rb.l - ra.r, 0, ra.l - rb.r);
  const dy = Math.max(rb.t - ra.b, 0, ra.t - rb.b);
  return Math.hypot(dx, dy);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
