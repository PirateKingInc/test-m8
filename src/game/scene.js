import { SIM_DT } from '../sim/constants.js';
import { drawTerrain, drawNode, drawBuilding, drawUnit, TEAM_COLORS } from './draw.js';

const Phaser = globalThis.Phaser;
const PAN_SPEED = 900; // px/s
const EDGE = 14; // px from the canvas edge that triggers edge-panning
const MAX_STEPS_PER_FRAME = 8; // avoid a spiral of death after a stall

export class GameScene extends Phaser.Scene {
  constructor(world, hud) {
    super('game');
    this.world = world;
    this.hud = hud;
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

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs, 250) / 1000;
    this.panCamera(dt);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.world.step();
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    this.render(this.acc / SIM_DT);
    this.hud?.update(this.world, this.game.loop.actualFps);
  }

  render(alpha) {
    const g = this.gfx, w = this.world;
    g.clear();
    for (const n of w.ofKind('node')) drawNode(g, n, w.time);
    for (const b of w.ofKind('building')) drawBuilding(g, b, TEAM_COLORS[b.team]);
    for (const u of w.ofKind('unit')) {
      const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
      drawUnit(g, u, x, y, TEAM_COLORS[u.team]);
    }
  }
}
