// Places the baked sprite textures (src/art) on sim entities each frame.
// Render-only: it reads entity state and never changes it. Gameplay size,
// collision and picking all come from the sim, never from these images.
import { ART_SCALE, unitKey, ringKey, RING_R } from '../art/atlas.js';

const DEPTH = { ring: 2.5, unit: 3 };
const FLASH = 0.09; // s a unit shows white after being hit
// Zoomed out, unit sprites are drawn up to 1.6x larger so they stay legible
// (visual only: collision and picking use the sim's radius).
export const unitBoost = (zoom) => Math.min(1.6, Math.max(1, 0.8 / zoom));

export class SpriteLayer {
  constructor(scene) {
    this.scene = scene;
    this.units = new Map(); // id -> { img, ring, key }
  }

  // alpha: interpolation between the previous and current sim step.
  sync(world, alpha) {
    const seen = new Set();
    const boost = unitBoost(this.scene.cameras.main.zoom);
    for (const u of world.ofKind('unit')) {
      seen.add(u.id);
      let s = this.units.get(u.id);
      const key = unitKey(u.type, u.team, u.type === 'drone' && u.carry > 0);
      if (!s) {
        const ring = this.scene.add.image(0, 0, ringKey(u.team)).setDepth(DEPTH.ring);
        const img = this.scene.add.image(0, 0, key).setDepth(DEPTH.unit);
        s = { img, ring, key, boost: 0 };
        this.units.set(u.id, s);
      }
      if (s.key !== key) { s.img.setTexture(key); s.key = key; }
      if (s.boost !== boost) {
        s.img.setScale(boost / ART_SCALE);
        s.ring.setScale((u.radius / RING_R / ART_SCALE) * boost);
        s.boost = boost;
      }
      const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
      s.img.setPosition(x, y).setRotation(u.facing || 0);
      s.ring.setPosition(x, y);
      if (u.lastHit !== undefined && world.time - u.lastHit < FLASH) s.img.setTintFill(0xffffff);
      else s.img.clearTint();
    }
    for (const [id, s] of this.units) {
      if (seen.has(id)) continue;
      s.img.destroy();
      s.ring.destroy();
      this.units.delete(id);
    }
  }
}
