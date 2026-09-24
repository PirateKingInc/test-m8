import { SIM_DT } from '../sim/constants.js';
import { drawTerrain, drawNode, drawBuilding, drawUnit, drawSelection, drawMarker, drawGhost, drawHealth, drawCrosshair, TEAM_COLORS } from './draw.js';
import { InputController } from './input.js';

const Phaser = globalThis.Phaser;
const PAN_SPEED = 900; // px/s
const EDGE = 14; // px from the canvas edge that triggers edge-panning
const MAX_STEPS_PER_FRAME = 8; // avoid a spiral of death after a stall

export class GameScene extends Phaser.Scene {
  constructor(world, hud, sfx) {
    super('game');
    this.world = world;
    this.hud = hud;
    this.sfx = sfx;
    this.acc = 0;
  }

  create() {
    const w = this.world;
    // Bake the static terrain once; redrawing ~5k shapes per frame is wasteful.
    const terrain = this.make.graphics({}, false);
    drawTerrain(terrain, w);
    this.add.renderTexture(0, 0, w.width, w.height).setOrigin(0).draw(terrain);
    terrain.destroy();
    this.gfx = this.add.graphics();

    const cam = this.cameras.main;
    cam.setBounds(0, -28, w.width, w.height + 28 + 104); // leave room under the HUD bars
    this.centerOnCore();

    this.input.mouse.disableContextMenu();
    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,HOME');
    this.keys.HOME.on('down', () => this.centerOnCore());
    this.pointerInside = false;
    this.game.canvas.addEventListener('mouseenter', () => { this.pointerInside = true; });
    this.game.canvas.addEventListener('mouseleave', () => { this.pointerInside = false; });
    this.input.on('pointermove', (p) => {
      if (p.middleButtonDown() && this.midDrag) {
        cam.scrollX = this.midDrag.sx - (p.x - this.midDrag.x);
        cam.scrollY = this.midDrag.sy - (p.y - this.midDrag.y);
      }
    });
    this.input.on('pointerdown', (p) => {
      if (p.middleButtonDown()) this.midDrag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointerup', () => { this.midDrag = null; });
    this.ui = new InputController(this, w);
    this.ui.on((name) => {
      if (name === 'select' || name === 'command') this.sfx?.ui(name);
    });
  }

  centerOnCore() {
    for (const b of this.world.ofKind('building')) {
      if (b.type === 'core' && b.team === 1) { this.cameras.main.centerOn(b.x, b.y); return; }
    }
  }

  panCamera(dt) {
    const cam = this.cameras.main, k = this.keys, p = this.input.activePointer;
    let dx = 0, dy = 0;
    if (k.LEFT.isDown) dx -= 1;
    if (k.RIGHT.isDown) dx += 1;
    if (k.UP.isDown) dy -= 1;
    if (k.DOWN.isDown) dy += 1;
    if (this.pointerInside && !this.midDrag) {
      const { width, height } = this.scale;
      if (p.x < EDGE) dx -= 1;
      if (p.x > width - EDGE) dx += 1;
      if (p.y < EDGE) dy -= 1;
      if (p.y > height - EDGE) dy += 1;
    }
    cam.scrollX += dx * PAN_SPEED * dt;
    cam.scrollY += dy * PAN_SPEED * dt;
  }

  update() {
    // Wall-clock delta: Phaser's delta is smoothed/capped, which starves the
    // fixed-timestep accumulator (and slows the sim) whenever frames are slow.
    const now = performance.now();
    const dt = Math.min(now - (this.lastNow ?? now), 250) / 1000;
    this.lastNow = now;
    this.panCamera(dt);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.world.step();
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    const events = this.world.drainEvents();
    if (events.length) {
      const mid = this.cameras.main.midPoint;
      this.sfx?.handle(events, mid.x, mid.y);
      for (const e of events) if (e.type === 'rejected' && e.team === 1) this.hud?.toast(e.reason);
    }
    this.render(this.acc / SIM_DT);
    this.hud?.update(this.world, this.game.loop.actualFps, this.ui);
  }

  render(alpha) {
    const g = this.gfx, w = this.world;
    g.clear();
    for (const n of w.ofKind('node')) drawNode(g, n, w.time);
    for (const b of w.ofKind('building')) drawBuilding(g, b, TEAM_COLORS[b.team]);
    const sel = this.ui.selection;
    for (const b of w.ofKind('building')) if (sel.has(b.id)) drawSelection(g, b, b.x, b.y);
    for (const n of w.ofKind('node')) if (sel.has(n.id)) drawSelection(g, n, n.x, n.y);
    for (const u of w.ofKind('unit')) {
      const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
      if (sel.has(u.id)) drawSelection(g, u, x, y);
      drawUnit(g, u, x, y, TEAM_COLORS[u.team]);
      if (u.hp < u.maxHp || sel.has(u.id)) drawHealth(g, x, y - u.radius - 7, u.radius * 2, u.hp / u.maxHp);
    }
    for (const b of w.ofKind('building')) {
      if (b.hp < b.maxHp || sel.has(b.id)) drawHealth(g, b.x, b.y - b.ph / 2 - 6, b.pw - 12, b.hp / b.maxHp);
    }
    if (this.ui.attackMode || this.ui.devSpawn) drawCrosshair(g, this.ui.hover, this.ui.devSpawn ? 0xff7a45 : 0xff5a5a);
    const ghost = this.ui.ghost();
    if (ghost) drawGhost(g, ghost, w.grid.tile);
    this.ui.markers = this.ui.markers.filter((m) => drawMarker(g, m, w.time));
    const d = this.ui.drag;
    if (d?.moved) {
      g.fillStyle(0x39d3c3, 0.08);
      g.fillRect(Math.min(d.wx, d.cx), Math.min(d.wy, d.cy), Math.abs(d.cx - d.wx), Math.abs(d.cy - d.wy));
      g.lineStyle(1, 0x39d3c3, 0.9);
      g.strokeRect(Math.min(d.wx, d.cx), Math.min(d.wy, d.cy), Math.abs(d.cx - d.wx), Math.abs(d.cy - d.wy));
    }
  }
}
