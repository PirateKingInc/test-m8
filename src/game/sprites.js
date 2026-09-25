// Places the baked sprite textures (src/art) on sim entities each frame.
// Render-only: it reads entity state and never changes it. Gameplay size,
// collision and picking all come from the sim, never from these images.
import { ART_SCALE, unitKey, ringKey, buildingKey, crystalKey, unitBoost, RING_R } from '../art/atlas.js';
import { stageOf } from '../art/terrain.js';
import { stateOf } from '../art/buildings.js';

const DEPTH = { crystal: 1.5, building: 2, ring: 2.5, unit: 3 };
const FLASH = 0.09; // s a unit shows white after being hit


export class SpriteLayer {
  constructor(scene) {
    this.scene = scene;
    this.units = new Map(); // id -> { img, ring, key }
    this.buildings = new Map(); // id -> { img, key }
    this.crystals = new Map(); // id -> { img, key }
  }

  // Crystal clusters shrink in steps as they are mined, and glow gently.
  syncCrystals(world) {
    const seen = new Set();
    for (const n of world.ofKind('node')) {
      seen.add(n.id);
      const key = crystalKey(stageOf(n.amount / n.maxAmount));
      let s = this.crystals.get(n.id);
      if (!s) { s = { img: this.scene.add.image(n.x, n.y, key).setDepth(DEPTH.crystal).setScale(1 / ART_SCALE), key }; this.crystals.set(n.id, s); }
      if (s.key !== key) { s.img.setTexture(key); s.key = key; }
      s.img.setAlpha(0.88 + 0.12 * Math.sin(world.time * 2 + n.id));
    }
    for (const [id, s] of this.crystals) if (!seen.has(id)) { s.img.destroy(); this.crystals.delete(id); }
  }

  // One image per building, in its construction state (foundation/frame/complete).
  syncBuildings(world) {
    const seen = new Set();
    for (const b of world.ofKind('building')) {
      seen.add(b.id);
      const key = buildingKey(b.type, b.team, stateOf(b));
      let s = this.buildings.get(b.id);
      if (!s) {
        s = { img: this.scene.add.image(b.x, b.y, key).setDepth(DEPTH.building).setScale(1 / ART_SCALE), key };
        this.buildings.set(b.id, s);
      }
      if (s.key !== key) { s.img.setTexture(key); s.key = key; }
    }
    for (const [id, s] of this.buildings) if (!seen.has(id)) { s.img.destroy(); this.buildings.delete(id); }
  }

  // alpha: interpolation between the previous and current sim step.
  sync(world, alpha) {
    this.syncCrystals(world);
    this.syncBuildings(world);
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
