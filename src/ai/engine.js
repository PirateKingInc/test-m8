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
import { STRATEGIES, SPOTS, ARMY } from '../data/strategies.js';
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
    this.stats = { commands: 0, rejected: 0, built: {}, trained: {}, waves: 0, reachedEnemyBase: false, coreAssaults: 0 };
    this.mode = 'gather'; // army state: gather | attack
    this.wave = []; // ids of the units in the current attack wave
    this.waveSize = 0;
    this.rallySet = new Set();
    this.depotsPlaced = 0;
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

  // Put every idle drone to work, spreading them over the crystals near our base
  // (least-busy node first, nearest on ties) so a big economy isn't one queue.
  gatherIdle() {
    const idle = this.mine('unit', 'drone').filter((d) => d.order.type === 'idle');
    const core = this.core();
    if (!idle.length || !core) return;
    const nodes = [...this.w.ofKind('node')]
      .map((n) => ({ n, d: Math.hypot(n.x - core.x, n.y - core.y) }))
      .sort((a, b) => a.d - b.d).slice(0, 4);
    if (!nodes.length) return;
    const busy = new Map(nodes.map(({ n }) => [n.id, 0]));
    for (const d of this.mine('unit', 'drone')) if (d.order.type === 'gather' && busy.has(d.order.node)) busy.set(d.order.node, busy.get(d.order.node) + 1);
    for (const d of idle) {
      const pick = nodes.reduce((a, b) => (busy.get(b.n.id) < busy.get(a.n.id) ? b : a));
      busy.set(pick.n.id, busy.get(pick.n.id) + 1);
      this.issue({ type: 'gather', ids: [d.id], node: pick.n.id });
    }
  }

  trackConstruction() {
    // Any unfinished site of ours with nobody building it (the builder died or
    // was pulled away) gets a new builder, so construction can never stall.
    for (const b of this.mine('building')) {
      if (b.built) continue;
      const drones = this.mine('unit', 'drone');
      if (!drones.length || drones.some((d) => d.order.type === 'build' && d.order.target === b.id)) continue;
      const pick = drones.reduce((a, d) => (Math.hypot(d.x - b.x, d.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? d : a));
      this.issue({ type: 'assist', ids: [pick.id], target: b.id });
      this.note(`reassigned builder to ${b.type}`);
    }
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

  // ---- macro loop (after the opening) --------------------------------------

  macro() {
    const s = this.s, sup = this.supply();
    // 1. Supply: a new Depot before we run out.
    const producers = this.mine('building', 'foundry').length + 1;
    if (sup.cap < 60 && sup.free <= s.supplyBuffer + producers && !this.pendingBuild) {
      const keys = s.depotSpots || ['depot'];
      const key = keys[Math.min(this.mine('building', 'depot').length, keys.length - 1)];
      if (this.tryBuild('depot', key)) return;
    }
    // 2. Workers up to the (difficulty-scaled) target, one at a time.
    const core = this.mine('building', 'core').find((b) => b.built);
    const target = Math.floor(s.workerTarget * this.d.workerFactor);
    if (core && core.queue.length === 0 && this.mine('unit', 'drone').length < target) this.tryTrain('drone', 1);
    // 3. More production when Lumen piles up, then strategy-specific structures.
    const foundries = this.mine('building', 'foundry').length;
    if (!this.pendingBuild && foundries < (s.maxFoundries ?? 1) && this.lumen() >= (s.floatLumen ?? Infinity)) {
      if (this.tryBuild('foundry', foundries ? 'foundry2' : 'foundry')) return;
    }
    for (const st of s.structures || []) {
      if (this.pendingBuild) break;
      if (this.structureWanted(st)) {
        const have = this.mine('building', st.build).length;
        this.tryBuild(st.build, st.spots[Math.min(have, st.spots.length - 1)]);
        break;
      }
    }
    // 4. Army from the composition weights, keeping Foundry queues short.
    const unit = this.nextArmyUnit();
    if (unit) this.tryTrain(unit, ARMY.maxFoundryQueue);
  }

  // A strategy structure rule: { build, spots, max, minDrones?, armyPer? }. Wanted
  // while we have fewer than `max`, enough Drones, and (armyPer) at least
  // armyPer combat units per existing building of that type.
  structureWanted(st) {
    const have = this.mine('building', st.build).length;
    if (have >= st.max) return false;
    if (st.minDrones && this.mine('unit', 'drone').length < st.minDrones) return false;
    if (st.armyPer && this.army().length < st.armyPer * have) return false;
    return this.lumen() >= BUILDINGS[st.build].cost;
  }

  // The composition type furthest below its target share (counting living and
  // queued units), so production follows the weights without any randomness.
  composition() { return this.s.composition; }

  nextArmyUnit() {
    const weights = this.composition();
    const types = Object.keys(weights).filter((t) => weights[t] > 0);
    if (!types.length) return null;
    const have = Object.fromEntries(types.map((t) => [t, 0]));
    for (const u of this.army()) if (u.type in have) have[u.type]++;
    for (const f of this.mine('building', 'foundry')) for (const q of f.queue) if (q.unit in have) have[q.unit]++;
    const total = types.reduce((n, t) => n + have[t], 0) + 1;
    const wsum = types.reduce((n, t) => n + weights[t], 0);
    let best = null, bestGap = -Infinity;
    for (const t of types) {
      const gap = weights[t] / wsum - have[t] / total;
      if (gap > bestGap) { bestGap = gap; best = t; }
    }
    return best;
  }

  // ---- army control -------------------------------------------------------

  enemyTeam() { return this.team === 1 ? 2 : 1; }

  // Both sides know the map, so both know where the enemy started.
  enemyStart() {
    const st = this.team === 1 ? this.w.map.aiStart : this.w.map.start;
    const T = this.w.grid.tile;
    return { x: (st.core[0] + 2) * T, y: (st.core[1] + 2) * T };
  }

  // What to hit: the enemy Command Core at its start if it still stands there,
  // otherwise the enemy start itself (attack-move engages whatever is there).
  attackTarget() {
    const p = this.enemyStart();
    for (const b of this.w.ofKind('building')) {
      if (b.team === this.enemyTeam() && b.type === 'core' && Math.hypot(b.x - p.x, b.y - p.y) < 200) return b;
    }
    return null;
  }

  rallyPoint() {
    const c = this.core(), e = this.enemyStart(), T = this.w.grid.tile;
    const d = Math.hypot(e.x - c.x, e.y - c.y) || 1;
    return { x: c.x + ((e.x - c.x) / d) * ARMY.rallyTiles * T, y: c.y + ((e.y - c.y) / d) * ARMY.rallyTiles * T };
  }

  nearBase(x, y) {
    for (const b of this.mine('building')) if (Math.hypot(b.x - x, b.y - y) < ARMY.homeRadius) return true;
    return false;
  }

  // Enemy combat units currently inside our base area.
  intruders() {
    const out = [];
    for (const u of this.w.ofKind('unit')) {
      if (u.team === this.enemyTeam() && COMBAT_TYPES.includes(u.type) && this.nearBase(u.x, u.y)) out.push(u);
    }
    return out;
  }

  commandArmy() {
    const s = this.s;
    const rally = this.rallyPoint();
    for (const f of this.mine('building', 'foundry')) {
      if (f.built && !this.rallySet.has(f.id)) { this.issue({ type: 'rally', building: f.id, ...rally }); this.rallySet.add(f.id); }
    }
    const army = this.army();
    const inWave = new Set(this.wave.filter((id) => this.w.get(id)));
    this.wave = [...inWave];
    const home = army.filter((u) => !inWave.has(u.id));

    // Defense: idle units at home go after intruders.
    const threats = this.intruders();
    if (threats.length) {
      const idle = home.filter((u) => u.order.type !== 'attack' && u.order.type !== 'attackMove');
      if (idle.length) this.issue({ type: 'attackMove', ids: idle.map((u) => u.id), x: threats[0].x, y: threats[0].y });
    }

    if (this.mode === 'attack') {
      if (!this.wave.length || (s.retreatBelow != null && this.wave.length < s.retreatBelow * this.waveSize)) {
        if (this.wave.length) { this.issue({ type: 'move', ids: this.wave, ...rally }); this.note(`retreat with ${this.wave.length}`); }
        this.mode = 'gather';
        this.wave = [];
        return;
      }
      // Reinforcements travel in groups so they aren't fed in one at a time.
      if (s.reinforce && home.length >= (s.reinforceMin ?? 1) && !threats.length) {
        this.joinWave(home);
      }
      this.pressAttack();
      return;
    }
    // A wave leaves when the army at home reaches the unit-count threshold, or
    // (for strategies that build up) the army-supply threshold.
    const need = this.stats.waves === 0 ? s.firstWave : s.wave;
    const needSupply = this.stats.waves === 0 ? s.firstWaveSupply : s.waveSupply;
    const homeSupply = home.reduce((n, u) => n + UNITS[u.type].supply, 0);
    const ready = needSupply != null ? homeSupply >= needSupply : home.length >= need;
    if (!threats.length && ready) {
      this.mode = 'attack';
      this.waveSize = home.length;
      this.stats.waves++;
      this.note(`wave ${this.stats.waves}: ${home.length} units attack`);
      this.joinWave(home);
    }
  }

  joinWave(units) {
    const t = this.attackTarget() || this.enemyStart();
    this.issue({ type: 'attackMove', ids: units.map((u) => u.id), x: t.x, y: t.y });
    for (const u of units) this.wave.push(u.id);
  }

  // Near the enemy Core with no enemy units around: hit the Core directly.
  pressAttack() {
    const core = this.attackTarget();
    const units = this.wave.map((id) => this.w.get(id)).filter(Boolean);
    if (!units.length) return;
    const cx = units.reduce((a, u) => a + u.x, 0) / units.length, cy = units.reduce((a, u) => a + u.y, 0) / units.length;
    const start = this.enemyStart();
    if (Math.hypot(cx - start.x, cy - start.y) < ARMY.homeRadius) this.stats.reachedEnemyBase = true;
    if (!core) return;
    const near = units.filter((u) => Math.hypot(u.x - core.x, u.y - core.y) < ARMY.coreAssault + core.pw);
    if (!near.length) {
      const idle = units.filter((u) => u.order.type === 'idle');
      if (idle.length) this.issue({ type: 'attackMove', ids: idle.map((u) => u.id), x: core.x, y: core.y });
      return;
    }
    const defended = [...this.w.ofKind('unit')].some((e) => e.team === this.enemyTeam() && COMBAT_TYPES.includes(e.type)
      && Math.hypot(e.x - core.x, e.y - core.y) < ARMY.coreAssault + core.pw);
    const free = near.filter((u) => !(u.order.type === 'attack' && u.order.target === core.id) && u.order.type !== 'attack');
    if (!defended && free.length) {
      this.issue({ type: 'attack', ids: free.map((u) => u.id), target: core.id });
      this.stats.coreAssaults++;
    }
  }

  // One decision round. The match loop calls update() every tick, which calls
  // think() every `decisionInterval`; the Phase 1 bot test calls think() directly.
  think() {
    this.trackConstruction();
    this.gatherIdle();
    const opened = this.runOpening();
    if (this.s.noMacro) return; // the Phase 1 sandbox script is opening-only
    if (opened) this.macro();
    this.commandArmy();
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
