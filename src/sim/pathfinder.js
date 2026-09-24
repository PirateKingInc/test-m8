// Grid routing via PathFinding.js (loaded from the CDN in the browser, from npm in tests).
export class Pathfinder {
  constructor(grid, PF) {
    if (!PF) throw new Error('PathFinding.js (PF) is required');
    this.grid = grid;
    this.PF = PF;
    // Legacy option names: the CDN browser build of 0.4.18 predates DiagonalMovement.
    // allowDiagonal + dontCrossCorners == diagonals only when no obstacle is touched.
    this.finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
    this.base = null;
    this.baseVersion = -1;
    this.searches = 0;
  }

  pfGrid() {
    if (this.baseVersion !== this.grid.version) {
      this.base = new this.PF.Grid(this.grid.cols, this.grid.rows, this.grid.toMatrix());
      this.baseVersion = this.grid.version;
    }
    return this.base.clone();
  }

  // Nearest tile to (gx,gy) that is reachable from (sx,sy), via flood fill.
  nearestReachable(sx, sy, gx, gy) {
    const g = this.grid, seen = new Uint8Array(g.cols * g.rows);
    const queue = [[sx, sy]];
    seen[g.idx(sx, sy)] = 1;
    let best = null, bestD = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const d = (x - gx) ** 2 + (y - gy) ** 2;
      if (d < bestD) { bestD = d; best = { tx: x, ty: y }; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (g.isWalkable(nx, ny) && !seen[g.idx(nx, ny)]) {
          seen[g.idx(nx, ny)] = 1;
          queue.push([nx, ny]);
        }
      }
    }
    return best;
  }

  // Waypoints in px from (x,y) toward (tx,ty). Blocked or unreachable goals resolve
  // to the nearest reachable tile. Returns null if the unit itself is boxed in.
  find(x, y, tx, ty) {
    const g = this.grid;
    let s = g.tileOf(x, y);
    if (!g.isWalkable(s.tx, s.ty)) s = g.nearestWalkable(s.tx, s.ty, 3);
    if (!s) return null;
    const goalTile = g.tileOf(tx, ty);
    let goal = { tx: Math.min(Math.max(goalTile.tx, 0), g.cols - 1), ty: Math.min(Math.max(goalTile.ty, 0), g.rows - 1) };
    let exact = goal.tx === goalTile.tx && goal.ty === goalTile.ty && g.isWalkable(goal.tx, goal.ty);
    if (!g.isWalkable(goal.tx, goal.ty)) goal = g.nearestWalkable(goal.tx, goal.ty, 12) || goal;

    this.searches++;
    let raw = this.finder.findPath(s.tx, s.ty, goal.tx, goal.ty, this.pfGrid());
    if (raw.length === 0) {
      exact = false;
      goal = this.nearestReachable(s.tx, s.ty, goalTile.tx, goalTile.ty);
      if (!goal) return null;
      raw = this.finder.findPath(s.tx, s.ty, goal.tx, goal.ty, this.pfGrid());
      if (raw.length === 0) return [];
    }
    const smooth = raw.length > 2 ? this.PF.Util.smoothenPath(this.pfGrid(), raw) : raw;
    const pts = smooth.slice(1).map(([cx, cy]) => g.center(cx, cy));
    if (exact) {
      if (pts.length) pts[pts.length - 1] = { x: tx, y: ty };
      else pts.push({ x: tx, y: ty });
    }
    return pts;
  }
}
