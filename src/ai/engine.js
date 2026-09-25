// The AI execution engine. It started life as the Phase 1 "sandbox bot"
// (test/bot.js), which proved the whole build/gather/train/fight loop works
// through the public command API. Phase 2 extends that same class into the
// opponent's engine: it executes a strategy script from src/data/strategies.js
// with timing from src/data/difficulty.js.
//
// Rules the engine lives by (SPEC.md Phase 2 "AI architecture"):
// - It *reads* the world only through `this.w` (a view; tests pass a recursively
//   read-only proxy) and *acts* only through `this.issue()`, which forwards to
//   world.issue() with the engine's own team stamped on and a command whitelist.
// - No Phaser, no DOM, no direct state mutation, no cheating.
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { STRATEGIES, SPOTS } from '../data/strategies.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { canPlace } from '../sim/construction.js';
import { supplyOf } from '../sim/supply.js';
import { createRng } from '../sim/rng.js';

// Everything a player can do through the UI, and nothing else (no devSpawn).
export const ALLOWED_COMMANDS = new Set([
  'build', 'assist', 'cancelBuild', 'train', 'cancelTrain', 'rally',
  'gather', 'returnCargo', 'move', 'stop', 'attack', 'attackMove',
]);

export const COMBAT_TYPES = ['striker', 'sparker', 'bulwark', 'lancer'];

export class AiEngine {
  // world: the real World (only its issue() is used); opts.view: what the engine
  // reads (defaults to the world itself).
  constructor(world, { team = 1, strategy = 'sandbox', difficulty = 'hard', view = world, seed = 1 } = {}) {
    this.w = view;
    this.team = team;
    this.issueFn = (cmd) => world.issue(cmd);
    this.strategyId = strategy;
    this.s = typeof strategy === 'string' ? STRATEGIES[strategy] : strategy;
    this.d = typeof difficulty === 'string' ? DIFFICULTY[difficulty] : difficulty;
    this.rng = createRng(seed * 31 + team); // the engine's own RNG, never the sim's
    this.log = [];
    this.step = 0; // index of the next opening step
    this.nextStepAt = 0; // game time before which the next opening step waits (stepDelay)
    this.nextThinkAt = 0;
    this.pendingBuild = null;
    this.stats = { commands: 0, rejected: 0, built: {}, trained: {} };
  }

  // ---- acting -------------------------------------------------------------

  issue(cmd) {
    if (!ALLOWED_COMMANDS.has(cmd.type)) throw new Error(`AI command not allowed: ${cmd.type}`);
    const res = this.issueFn({ ...cmd, team: this.team });
    this.stats.commands++;
    if (!res.ok) this.stats.rejected++;
    return res;
  }

  note(msg) { this.log.push(`[${this.w.time.toFixed(1)}s] ${msg}`); }

  // ---- reading ------------------------------------------------------------

  mine(kind, type) {
    const out = [];
    for (const e of this.w.ofKind(kind)) if (e.team === this.team && (!type || e.type === type)) out.push(e);
    return out;
  }

  core() {
    return this.mine('building', 'core').find((b) => b.built) || this.mine('building', 'core')[0];
  }

  // The west base's spot offsets, mirrored when our Core sits in the east half.
  spot(key, type) {
    const c = this.core(), def = BUILDINGS[type];
    const [dx, dy] = SPOTS[key] || SPOTS[type];
    const east = c.x > this.w.width / 2;
    return { tx: east ? c.tx + c.w - dx - def.w : c.tx + dx, ty: c.ty + dy };
  }

  // A valid footprint near the desired spot that leaves a one-tile walkable ring
  // around the building, so the AI never walls in its own units.
  placement(type, key) {
    const want = this.spot(key, type), def = BUILDINGS[type], g = this.w.grid;
    const ringFree = (tx, ty) => {
      for (let y = ty - 1; y <= ty + def.h; y++) for (let x = tx - 1; x <= tx + def.w; x++) {
        const edge = x === tx - 1 || x === tx + def.w || y === ty - 1 || y === ty + def.h;
        if (edge && g.inBounds(x, y) && !g.isWalkable(x, y)) return false;
      }
      return true;
    };
    for (const strict of [true, false]) {
      for (let r = 0; r <= 8; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = want.tx + dx, ty = want.ty + dy;
          if (canPlace(this.w, type, tx, ty) && (!strict || ringFree(tx, ty))) return { tx, ty };
        }
      }
    }
    return null;
  }

  homeNode() {
    const core = this.core();
    if (!core) return null;
    let best = null, bestD = Infinity;
    for (const n of this.w.ofKind('node')) {
      const d = Math.hypot(n.x - core.x, n.y - core.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  army() {
    return this.mine('unit').filter((u) => COMBAT_TYPES.includes(u.type));
  }

  supply() { return supplyOf(this.w, this.team); }

  lumen() { return this.w.resources[this.team] || 0; }

  // ---- decisions ----------------------------------------------------------

  // Put every idle drone to work on the crystal nearest our base.
  gatherIdle() {
    const idle = this.mine('unit', 'drone').filter((d) => d.order.type === 'idle');
    const node = this.homeNode();
    if (idle.length && node) this.issue({ type: 'gather', ids: idle.map((d) => d.id), node: node.id });
  }

  trackConstruction() {
    if (!this.pendingBuild) return;
    const b = this.w.get(this.pendingBuild);
    if (!b) this.pendingBuild = null;
    else if (b.built) {
      this.note(`${b.type} complete`);
      this.stats.built[b.type] = (this.stats.built[b.type] || 0) + 1;
      this.pendingBuild = null;
    }
  }

  tryBuild(type, key = type) {
    if (this.pendingBuild || this.lumen() < BUILDINGS[type].cost) return false;
    const at = this.placement(type, key);
    const drones = this.mine('unit', 'drone');
    if (!at || !drones.length) return false;
    const builder = drones.find((d) => d.order.type === 'gather' && d.carry === 0) || drones[0];
    const res = this.issue({ type: 'build', ids: [builder.id], building: type, tx: at.tx, ty: at.ty });
    if (res.ok) { this.pendingBuild = res.id; this.note(`placed ${type} at (${at.tx},${at.ty})`); }
    return res.ok;
  }

  // Queue a unit at a completed building that trains it (shortest queue first).
  tryTrain(unit, maxQueue = 5) {
    const where = UNITS[unit].trainedAt;
    const hosts = this.mine('building', where).filter((b) => b.built && b.queue.length < maxQueue);
    if (!hosts.length || this.lumen() < UNITS[unit].cost || this.supply().free < UNITS[unit].supply) return false;
    hosts.sort((a, b) => a.queue.length - b.queue.length);
    const res = this.issue({ type: 'train', building: hosts[0].id, unit });
    if (res.ok) {
      this.note(`queued ${unit}`);
      this.stats.trained[unit] = (this.stats.trained[unit] || 0) + 1;
    }
    return res.ok;
  }

  // Execute the next opening step if its time has come. Returns true when done.
  runOpening() {
    const steps = this.s.opening;
    if (this.step >= steps.length) return true;
    if (this.w.time < this.nextStepAt) return false;
    const st = steps[this.step];
    const ok = st.build ? this.tryBuild(st.build, st.spot) : this.tryTrain(st.train);
    if (ok) {
      this.step++;
      this.nextStepAt = this.w.time + this.d.stepDelay;
    }
    return this.step >= steps.length;
  }

  // One decision round. The match loop calls update() every tick, which calls
  // think() every `decisionInterval`; the Phase 1 bot test calls think() directly.
  think() {
    this.trackConstruction();
    this.gatherIdle();
    this.runOpening();
  }

  update() {
    if (this.w.result || this.w.time < this.nextThinkAt) return;
    this.nextThinkAt = this.w.time + this.d.decisionInterval;
    if (!this.core()) return; // defeated
    this.think();
  }
}

// The Phase 1 bot, now a thin preset of the engine running the sandbox script.
export class SandboxBot extends AiEngine {
  constructor(world, opts = {}) {
    super(world, { team: 1, strategy: 'sandbox', difficulty: 'hard', ...opts });
  }
}
