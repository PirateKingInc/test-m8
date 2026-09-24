import { PLAYER } from '../sim/constants.js';

// DOM HUD overlay. Reads world state; never mutates it.
export class Hud {
  constructor(doc = document) {
    this.el = {
      lumen: doc.getElementById('lumen'),
      units: doc.getElementById('unit-count'),
      fps: doc.getElementById('fps'),
    };
    this.lastRefresh = 0;
  }

  update(world, fps) {
    const now = performance.now();
    if (now - this.lastRefresh < 100) return;
    this.lastRefresh = now;
    let units = 0;
    for (const u of world.ofKind('unit')) if (u.team === PLAYER) units++;
    this.el.lumen.textContent = Math.floor(world.resources[PLAYER]);
    this.el.units.textContent = units;
    this.el.fps.textContent = `${Math.round(fps)} fps`;
  }
}
