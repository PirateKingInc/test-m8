// A scripted "sandbox bot" that plays the whole Phase 1 loop through the public
// command API only (world.issue), exactly like the UI does. Used by
// test/bot.test.js as the end-to-end proof that the loop works.
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { canPlace } from '../sim/construction.js';

const TEAM = 1;
const BUILD_SPOTS = { depot: [17, 26], foundry: [14, 32], spire: [18, 31], core: [9, 34] };
const ARMY = ['striker', 'sparker', 'bulwark', 'lancer'];
const EXTRA_DRONES = 2;

export class SandboxBot {
  constructor(world) {
    this.w = world;
    this.log = [];
    this.phase = 'economy';
    this.pendingBuild = null;
    this.trainedArmy = new Set();
    this.dronesQueued = 0;
  }

  mine(kind, type) {
    return [...this.w.ofKind(kind)].filter((e) => e.team === TEAM && (!type || e.type === type));
  }

  note(msg) { this.log.push(`[${this.w.time.toFixed(1)}s] ${msg}`); }

  homeNode() {
    const core = this.mine('building', 'core')[0];
    return [...this.w.ofKind('node')].sort((a, b) => Math.hypot(a.x - core.x, a.y - core.y) - Math.hypot(b.x - core.x, b.y - core.y))[0];
  }

  // Put every idle drone to work on the nearest crystal.
  gatherIdle() {
    const idle = this.mine('unit', 'drone').filter((d) => d.order.type === 'idle');
    if (idle.length && this.homeNode()) this.w.issue({ type: 'gather', ids: idle.map((d) => d.id), node: this.homeNode().id });
  }

  have(type, built = true) {
    return this.mine('building', type).some((b) => !built || b.built);
  }

  tryBuild(type) {
    if (this.pendingBuild || this.w.resources[TEAM] < BUILDINGS[type].cost) return false;
    let [tx, ty] = BUILD_SPOTS[type];
    for (let dx = 0; !canPlace(this.w, type, tx, ty) && dx < 10; dx++) tx++;
    const builder = this.mine('unit', 'drone').find((d) => d.order.type === 'gather' && d.carry === 0) || this.mine('unit', 'drone')[0];
    const res = this.w.issue({ type: 'build', ids: [builder.id], building: type, tx, ty });
    if (res.ok) { this.pendingBuild = res.id; this.note(`placed ${type} at (${tx},${ty})`); }
    return res.ok;
  }

  // One decision per call; call every ~0.5 s of sim time.
  think() {
    const w = this.w;
    if (this.pendingBuild) {
      const b = w.get(this.pendingBuild);
      if (!b) this.pendingBuild = null;
      else if (b.built) { this.note(`${b.type} complete`); this.pendingBuild = null; }
    }
    this.gatherIdle();
    const core = this.mine('building', 'core').find((b) => b.built);
    if (core && this.dronesQueued < EXTRA_DRONES && w.resources[TEAM] >= UNITS.drone.cost + (this.have('depot', false) ? 0 : BUILDINGS.depot.cost)) {
      if (w.issue({ type: 'train', building: core.id, unit: 'drone' }).ok) { this.dronesQueued++; this.note('queued drone'); }
    }
    for (const type of ['depot', 'foundry', 'spire', 'core']) {
      if (type === 'core' ? this.mine('building', 'core').length >= 2 : this.have(type, false)) continue;
      this.tryBuild(type);
      return;
    }
    const foundry = this.mine('building', 'foundry').find((b) => b.built);
    if (foundry) {
      for (const unit of ARMY) {
        if (this.trainedArmy.has(unit)) continue;
        if (w.issue({ type: 'train', building: foundry.id, unit }).ok) { this.trainedArmy.add(unit); this.note(`queued ${unit}`); }
        break;
      }
    }
  }

  army() {
    return this.mine('unit').filter((u) => ARMY.includes(u.type));
  }
}
