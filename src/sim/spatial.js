// Uniform-grid spatial index over units and buildings (SPEC.md Phase 2 "Enemy
// scanning"). Rebuilt once per tick; queries touch only nearby cells, so target
// acquisition costs ~ the number of entities near a unit, not in the world.
export const CELL = 128;
const SLACK = 24; // px: covers the largest unit radius plus movement within a tick

export class SpatialIndex {
  constructor(cell = CELL) {
    this.cell = cell;
    this.cells = new Map();
    this.stamp = 0;
    this.visits = 0; // candidate entities examined (for tests / diagnostics)
  }

  key(cx, cy) { return cx * 4096 + cy; }

  insert(e, cx, cy) {
    const k = this.key(cx, cy);
    let list = this.cells.get(k);
    if (!list) this.cells.set(k, (list = []));
    list.push(e);
  }

  rebuild(world) {
    this.cells.clear();
    const c = this.cell;
    for (const e of world.entities.values()) {
      if (e.kind === 'unit') this.insert(e, Math.floor(e.x / c), Math.floor(e.y / c));
      else if (e.kind === 'building') {
        const x0 = Math.floor((e.x - e.pw / 2) / c), x1 = Math.floor((e.x + e.pw / 2) / c);
        const y0 = Math.floor((e.y - e.ph / 2) / c), y1 = Math.floor((e.y + e.ph / 2) / c);
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.insert(e, cx, cy);
      }
    }
  }

  // Call fn(entity) once for every unit/building whose footprint could lie within
  // `reach` px of point (x, y). Buildings spanning several cells are reported once.
  query(x, y, reach, fn) {
    const c = this.cell, r = reach + SLACK;
    const stamp = ++this.stamp;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const e of list) {
          if (e._qs === stamp) continue;
          e._qs = stamp;
          this.visits++;
          fn(e);
        }
      }
    }
  }
}
