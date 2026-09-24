import { MAP } from '../data/map.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { Grid } from './grid.js';
import { createRng } from './rng.js';
import { SIM_DT, PLAYER } from './constants.js';
import { Pathfinder } from './pathfinder.js';
import { issueCommand, thinkUnit } from './orders.js';
import { updateConstruction } from './construction.js';
import './economy.js';

// The headless game state. No Phaser/DOM here: the renderer reads entities,
// and everything that changes the world goes through issue(cmd).
export class World {
  constructor({ map = MAP, seed = 1337, PF = globalThis.PF, setup = 'start' } = {}) {
    this.map = map;
    this.PF = PF;
    this.rng = createRng(seed);
    this.grid = new Grid(map.cols, map.rows, map.tile);
    this.width = map.cols * map.tile;
    this.height = map.rows * map.tile;
    this.time = 0;
    this.tick = 0;
    this.nextId = 1;
    this.entities = new Map();
    this.resources = { [PLAYER]: map.startingLumen };
    this.events = []; // drained by the renderer/audio each frame

    this.pathfinder = new Pathfinder(this.grid, PF);
    for (const [x, y, w, h] of map.rocks) this.grid.setRock(x, y, w, h);
    for (const [tx, ty] of map.nodes) this.addNode(tx, ty, map.nodeAmount);
    if (setup === 'start') this.setupStart(map.start);
  }

  setupStart(start) {
    this.addBuilding('core', start.team, start.core[0], start.core[1], { built: true });
    for (const [tx, ty] of start.drones) {
      const c = this.grid.center(tx, ty);
      this.addUnit('drone', start.team, c.x, c.y);
    }
  }

  emit(type, data = {}) {
    this.events.push({ ...data, type, t: this.time });
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  add(e) {
    e.id = this.nextId++;
    this.entities.set(e.id, e);
    return e;
  }

  addNode(tx, ty, amount) {
    const s = this.map.nodeSize, T = this.grid.tile;
    const e = this.add({
      kind: 'node', tx, ty, w: s, h: s, pw: s * T, ph: s * T,
      x: (tx + s / 2) * T, y: (ty + s / 2) * T, amount, maxAmount: amount,
    });
    this.grid.setOccupant(tx, ty, s, s, e.id);
    return e;
  }

  addBuilding(type, team, tx, ty, { built = false } = {}) {
    const def = BUILDINGS[type], T = this.grid.tile;
    const e = this.add({
      kind: 'building', type, team, tx, ty, w: def.w, h: def.h, pw: def.w * T, ph: def.h * T,
      x: (tx + def.w / 2) * T, y: (ty + def.h / 2) * T,
      maxHp: def.hp, hp: def.hp, built, progress: built ? 1 : 0,
      queue: [], rally: null, cooldown: 0, target: null,
    });
    this.grid.setOccupant(tx, ty, def.w, def.h, e.id);
    return e;
  }

  addUnit(type, team, x, y) {
    const def = UNITS[type];
    return this.add({
      kind: 'unit', type, team, x, y, px: x, py: y,
      radius: def.radius, speed: def.speed, maxHp: def.hp, hp: def.hp,
      order: { type: 'idle' }, path: null, cooldown: 0, carry: 0, facing: 0,
    });
  }

  removeEntity(e) {
    this.entities.delete(e.id);
    if (e.kind !== 'unit') this.grid.setOccupant(e.tx, e.ty, e.w, e.h, 0);
  }

  get(id) {
    return this.entities.get(id);
  }

  *ofKind(kind) {
    for (const e of this.entities.values()) if (e.kind === kind) yield e;
  }

  issue(cmd) {
    return issueCommand(this, cmd);
  }

  step() {
    const units = [...this.ofKind('unit')];
    for (const u of units) { u.px = u.x; u.py = u.y; }
    for (const u of units) thinkUnit(this, u, SIM_DT);
    updateConstruction(this, SIM_DT);
    this.time += SIM_DT;
    this.tick++;
  }

  run(seconds) {
    const n = Math.round(seconds / SIM_DT);
    for (let i = 0; i < n; i++) this.step();
  }
}
