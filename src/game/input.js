// Mouse/keyboard -> selection state and world commands. Never mutates the sim directly.
import { pickAt, boxSelect, Selection, ControlGroups } from '../sim/selection.js';
import { PLAYER } from '../sim/constants.js';
import { BUILDINGS, BUILD_ORDER } from '../data/buildings.js';
import { canPlace } from '../sim/construction.js';

const DRAG_THRESHOLD = 6; // px on screen
const DOUBLE_TAP = 0.35; // s

export class InputController {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.selection = new Selection();
    this.groups = new ControlGroups();
    this.drag = null;
    this.markers = [];
    this.lastGroup = { n: 0, at: -1 };
    this.listeners = new Set();
    this.placing = null; // building type while in placement mode
    this.hover = { x: 0, y: 0 };

    const input = scene.input;
    input.on('pointerdown', (p) => this.onDown(p));
    input.on('pointermove', (p) => this.onMove(p));
    input.on('pointerup', (p) => this.onUp(p));
    input.keyboard.on('keydown', (e) => this.onKey(e));
  }

  // Hook for audio/HUD: fn(eventName, data).
  on(fn) { this.listeners.add(fn); }
  notify(name, data) { for (const fn of this.listeners) fn(name, data); }

  onDown(p) {
    if (this.placing) {
      if (p.rightButtonDown()) this.placing = null;
      else if (p.leftButtonDown()) this.place(p.event.shiftKey);
      return;
    }
    if (p.rightButtonDown()) { this.command(p.worldX, p.worldY); return; }
    if (!p.leftButtonDown()) return;
    this.drag = { sx: p.x, sy: p.y, wx: p.worldX, wy: p.worldY, cx: p.worldX, cy: p.worldY, shift: p.event.shiftKey };
  }

  onMove(p) {
    this.hover = { x: p.worldX, y: p.worldY };
    if (this.drag) { this.drag.cx = p.worldX; this.drag.cy = p.worldY; this.drag.moved ||= Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > DRAG_THRESHOLD; }
  }

  onUp(p) {
    const d = this.drag;
    if (!d || !p.leftButtonReleased()) return;
    this.drag = null;
    if (d.moved) this.selectBox(d.wx, d.wy, p.worldX, p.worldY, d.shift);
    else this.selectAt(p.worldX, p.worldY, d.shift);
  }

  selectBox(x1, y1, x2, y2, additive) {
    const ids = boxSelect(this.world, x1, y1, x2, y2, PLAYER);
    if (additive) this.selection.add(ids);
    else this.selection.set(ids);
    if (ids.length) this.notify('select', { ids });
  }

  selectAt(x, y, additive) {
    const e = pickAt(this.world, x, y);
    if (!e) { if (!additive) this.selection.clear(); return; }
    // Only own entities join a multi-selection; anything can be inspected alone.
    if (additive && e.team === PLAYER && this.selection.entities(this.world).every((s) => s.team === PLAYER)) {
      this.selection.toggle(e.id);
    } else {
      this.selection.set([e.id]);
    }
    this.notify('select', { ids: [e.id] });
  }

  ownSelected(kind) {
    return this.selection.entities(this.world).filter((e) => e.team === PLAYER && (!kind || e.kind === kind));
  }

  // Footprint under the cursor for the building being placed.
  ghost() {
    if (!this.placing) return null;
    const def = BUILDINGS[this.placing], T = this.world.grid.tile;
    const tx = Math.round(this.hover.x / T - def.w / 2), ty = Math.round(this.hover.y / T - def.h / 2);
    return { type: this.placing, tx, ty, w: def.w, h: def.h, valid: canPlace(this.world, this.placing, tx, ty) };
  }

  place(keepPlacing) {
    const g = this.ghost();
    const drones = this.ownSelected('unit').filter((u) => u.type === 'drone');
    const res = this.world.issue({ type: 'build', ids: drones.map((u) => u.id), building: g.type, tx: g.tx, ty: g.ty });
    if (res.ok) {
      const T = this.world.grid.tile;
      this.mark((g.tx + g.w / 2) * T, (g.ty + g.h / 2) * T, 'build');
      if (!keepPlacing) this.placing = null;
    }
  }

  // Buttons for the HUD command card, derived from the current selection.
  commandCard() {
    const sel = this.ownSelected();
    const lumen = this.world.resources[PLAYER];
    if (sel.length && sel.every((e) => e.kind === 'unit') && sel.some((u) => u.type === 'drone')) {
      return BUILD_ORDER.map((type) => {
        const d = BUILDINGS[type];
        return { key: d.hotkey, label: d.name, cost: d.cost, action: `build:${type}`, enabled: lumen >= d.cost, active: this.placing === type };
      });
    }
    if (sel.length === 1 && sel[0].kind === 'building' && !sel[0].built) {
      return [{ key: 'X', label: 'Cancel build', cost: null, action: 'cancel-build', enabled: true }];
    }
    return [];
  }

  action(name) {
    const [verb, arg] = name.split(':');
    if (verb === 'build') this.placing = arg;
    else if (verb === 'cancel-build') {
      const b = this.ownSelected('building')[0];
      if (b) this.world.issue({ type: 'cancelBuild', id: b.id });
    }
    this.notify('action', { name });
  }

  // Right-click: contextual command for the selection.
  command(x, y) {
    const units = this.ownSelected('unit');
    if (!units.length) return;
    const target = pickAt(this.world, x, y);
    const drones = units.filter((u) => u.type === 'drone');
    if (target?.kind === 'building' && target.team === PLAYER && !target.built && drones.length) {
      this.world.issue({ type: 'assist', ids: drones.map((u) => u.id), target: target.id });
      this.mark(target.x, target.y, 'build');
      return;
    }
    const res = this.world.issue({ type: 'move', ids: units.map((u) => u.id), x, y });
    if (res.ok) this.mark(x, y, 'move');
  }

  mark(x, y, kind) {
    this.markers.push({ x, y, kind, t: this.world.time });
    this.notify('command', { kind });
  }

  onKey(e) {
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      const n = Number(m[1]);
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        this.groups.assign(n, this.selection.ids.filter((id) => this.world.get(id)?.team === PLAYER));
        this.notify('group-assign', { n });
      } else {
        this.recallGroup(n);
      }
      return;
    }
    if (e.code === 'Escape') { this.placing = null; return; }
    if (e.code === 'KeyS') { this.world.issue({ type: 'stop', ids: this.selection.ids }); return; }
    const btn = this.commandCard().find((b) => `Key${b.key}` === e.code);
    if (btn && btn.enabled) this.action(btn.action);
  }

  recallGroup(n) {
    const ids = this.groups.recall(n, this.world);
    if (!ids.length) return;
    const now = performance.now() / 1000;
    const doubleTap = this.lastGroup.n === n && now - this.lastGroup.at < DOUBLE_TAP;
    this.lastGroup = { n, at: now };
    this.selection.set(ids);
    if (doubleTap) {
      const es = ids.map((id) => this.world.get(id));
      const cx = es.reduce((s, e) => s + e.x, 0) / es.length, cy = es.reduce((s, e) => s + e.y, 0) / es.length;
      this.scene.cameras.main.centerOn(cx, cy);
    }
    this.notify('select', { ids });
  }
}
