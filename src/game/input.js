// Mouse/keyboard -> selection state and world commands. Never mutates the sim directly.
import { pickAt, boxSelect, Selection, ControlGroups } from '../sim/selection.js';
import { PLAYER } from '../sim/constants.js';

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
    if (p.rightButtonDown()) { this.command(p.worldX, p.worldY); return; }
    if (!p.leftButtonDown()) return;
    this.drag = { sx: p.x, sy: p.y, wx: p.worldX, wy: p.worldY, cx: p.worldX, cy: p.worldY, shift: p.event.shiftKey };
  }

  onMove(p) {
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

  // Right-click: contextual command for the selection.
  command(x, y) {
    const units = this.ownSelected('unit');
    if (!units.length) return;
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
    if (e.code === 'KeyS') this.world.issue({ type: 'stop', ids: this.selection.ids });
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
