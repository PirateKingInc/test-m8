// AI perception (SPEC.md Phase 2 "Scouting: what the AI can see"). The AI does
// not get full map knowledge: it only records enemy entities inside its base
// watch or its units' sight, remembers them for a while, and sends one scout
// Drone to the enemy start. This is AI-side information only, not fog of war.
import { SCOUTING } from '../data/strategies.js';
import { COMBAT_TYPES } from './engine-types.js';

export class Scout {
  constructor(engine, cfg = SCOUTING) {
    this.e = engine;
    this.cfg = cfg;
    this.memory = new Map(); // enemy id -> { kind, type, x, y, seenAt, nearBase }
    this.nextScanAt = 0;
    this.scoutId = null;
    this.scoutSentAt = null;
    this.scoutDone = false;
    this.scoutArrivedAt = null;
  }

  // Where our eyes are: base watch circles around buildings, sight around units.
  eyes() {
    const eyes = [];
    for (const b of this.e.mine('building')) eyes.push({ x: b.x, y: b.y, r: this.cfg.baseWatch, base: true });
    for (const u of this.e.mine('unit')) eyes.push({ x: u.x, y: u.y, r: this.cfg.sight, base: false });
    return eyes;
  }

  scan() {
    const now = this.e.w.time, enemy = this.e.enemyTeam();
    const eyes = this.eyes();
    const inView = (x, y) => {
      let seen = false, base = false;
      for (const eye of eyes) {
        if (Math.hypot(eye.x - x, eye.y - y) <= eye.r) { seen = true; if (eye.base) { base = true; break; } }
      }
      return { seen, base };
    };
    for (const t of this.e.w.entities.values()) {
      if (t.team !== enemy || (t.kind !== 'unit' && t.kind !== 'building') || t.hp <= 0) continue;
      const v = inView(t.x, t.y);
      if (v.seen) this.memory.set(t.id, { kind: t.kind, type: t.type, x: t.x, y: t.y, seenAt: now, nearBase: v.base });
    }
    // Sightings are remembered for `memory` seconds (even if that unit has since
    // died: "the enemy fielded six Strikers" is still true information).
    for (const [id, m] of this.memory) if (now - m.seenAt > this.cfg.memory) this.memory.delete(id);
  }

  // The scout Drone: sent once at the strategy's scoutAt, walks to the enemy
  // start, then goes back to mining (on arrival or after scoutGiveUp seconds).
  runScout() {
    const at = this.e.s.scoutAt, now = this.e.w.time;
    if (this.scoutDone || at == null || now < at) return;
    if (this.scoutId == null) {
      const d = this.e.mine('unit', 'drone').find((u) => u.order.type === 'gather' && u.carry === 0);
      if (!d) return;
      const p = this.e.enemyStart(); // the pathfinder stops at the nearest reachable tile
      this.e.issue({ type: 'move', ids: [d.id], x: p.x, y: p.y });
      this.scoutId = d.id;
      this.scoutSentAt = now;
      this.e.note('scout drone sent');
      return;
    }
    const d = this.e.w.get(this.scoutId);
    if (!d) { this.scoutDone = true; this.e.note('scout drone lost'); return; }
    if (d.order.type === 'idle') this.scoutArrivedAt ??= now;
    // Loiter at the enemy start long enough for two scans, then go back to work.
    const looked = this.scoutArrivedAt != null && now - this.scoutArrivedAt >= 2 * this.cfg.interval;
    if (looked || now - this.scoutSentAt > this.cfg.scoutGiveUp) {
      this.scoutDone = true; // gatherIdle() puts it back to work
      if (d.order.type !== 'idle') this.e.issue({ type: 'stop', ids: [d.id] });
      this.e.note('scout drone returning');
    }
  }

  // The Drone currently out scouting (gatherIdle leaves it alone).
  activeScout() { return this.scoutDone ? null : this.scoutId; }

  update() {
    this.runScout();
    if (this.e.w.time < this.nextScanAt) return false;
    this.nextScanAt = this.e.w.time + this.cfg.interval;
    this.scan();
    return true;
  }

  // ---- derived knowledge -------------------------------------------------

  seenArmy() {
    const counts = Object.fromEntries(COMBAT_TYPES.map((t) => [t, 0]));
    for (const m of this.memory.values()) if (m.kind === 'unit' && m.type in counts) counts[m.type]++;
    return counts;
  }

  // Enemy combat units seen inside our base watch in the latest scan.
  intrudersSeen() {
    const now = this.e.w.time;
    return [...this.memory.values()].filter((m) => m.kind === 'unit' && COMBAT_TYPES.includes(m.type) && m.nearBase && now - m.seenAt < this.cfg.interval + 0.01);
  }

  knownBuildings(type) {
    return [...this.memory.values()].filter((m) => m.kind === 'building' && (!type || m.type === type));
  }
}
