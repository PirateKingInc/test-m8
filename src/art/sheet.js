// The visual reference sheet (tools/sheet.html -> docs/reference-sheet.png):
// every unit, every building in each construction state and every crystal
// stage, for both teams, at the in-game zoom levels 1.0x and 0.5x. Units at
// 0.5x include the in-game zoom-out boost (src/game/sprites.js).
import { bakeAll, bakeTerrain, unitKey, buildingKey, crystalKey, ringKey, unitBoost, ART_SCALE, RING_R, TEAMS } from './atlas.js';
import { UNIT_TYPES } from './units.js';
import { BUILDING_TYPES, STATES } from './buildings.js';
import { CRYSTAL_STAGES } from './terrain.js';
import { UNITS } from '../data/units.js';

const Phaser = globalThis.Phaser;
const W = 1500, ZOOMS = [1, 0.5];
const LABEL = { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#cfe8ff' };
const HEAD = { fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#39d3c3' };

class Sheet extends Phaser.Scene {
  create() {
    bakeAll(this.textures);
    // A small terrain sample: a ridge with a gap and an outcrop.
    const rockAt = new Set(['3,0', '3,1', '3,2', '3,4', '3,5', '8,2', '9,2', '8,3', '9,3']);
    const grid = { cols: 12, rows: 6, tile: 32, idx: (x, y) => `${x},${y}`, rock: new Proxy({}, { get: (_, k) => rockAt.has(k) }) };
    bakeTerrain(this.textures, grid);
    let y = 20;
    this.add.text(20, y, 'Prism Outpost: sprite reference sheet (all art drawn in code). Left: 1.0x zoom. Right: 0.5x zoom as drawn in game.', HEAD);
    y += 40;
    for (const team of TEAMS) {
      this.add.text(20, y, `Units, team ${team} (${team === 1 ? 'player, teal' : 'AI, orange'})`, HEAD); y += 30;
      ZOOMS.forEach((zoom, zi) => {
        const x0 = 40 + zi * 720;
        UNIT_TYPES.filter((t) => t !== 'dummy').concat(['drone-carry']).forEach((t, i) => {
          const type = t === 'drone-carry' ? 'drone' : t, cx = x0 + 60 + i * 110, cy = y + 50;
          const boost = unitBoost(zoom);
          this.add.image(cx, cy + 4, ringKey(team)).setScale((UNITS[type].radius / RING_R / ART_SCALE) * zoom * boost);
          this.add.image(cx, cy, unitKey(type, team, t === 'drone-carry')).setScale((zoom * boost) / ART_SCALE).setRotation(-Math.PI / 2);
          this.add.text(cx, cy + 46, t === 'drone-carry' ? 'drone (carrying)' : type, LABEL).setOrigin(0.5, 0);
        });
        this.add.text(x0, y - 4, `${zoom}x`, LABEL);
      });
      y += 120;
    }
    for (const team of TEAMS) {
      this.add.text(20, y, `Buildings, team ${team}: foundation / frame / complete`, HEAD); y += 30;
      ZOOMS.forEach((zoom, zi) => {
        const x0 = 40 + zi * 720;
        this.add.text(x0, y - 4, `${zoom}x`, LABEL);
        BUILDING_TYPES.forEach((type, i) => STATES.forEach((st, j) => {
          const cx = x0 + 90 + j * (zoom === 1 ? 150 : 80), cy = y + 80 + i * (zoom === 1 ? 160 : 90);
          this.add.image(cx, cy, buildingKey(type, team, st)).setScale(zoom / ART_SCALE);
          if (j === 0) this.add.text(x0, cy - 8, type, LABEL);
        }));
      });
      y += 4 * 160 + 40;
    }
    this.add.text(20, y, 'Crystals (full / mined / nearly empty) and terrain', HEAD); y += 30;
    ZOOMS.forEach((zoom, zi) => {
      const x0 = 40 + zi * 720;
      CRYSTAL_STAGES.forEach((st, i) => this.add.image(x0 + 60 + i * 100, y + 50, crystalKey(st)).setScale(zoom / ART_SCALE));
      this.add.image(x0 + 360, y + 10, 'terrain').setOrigin(0).setScale(zoom);
    });
    y += 230;
    this.scale.resize(W, y);
    window.__sheet = { ready: true, height: y, textures: this.textures.getTextureKeys().length };
  }
}

new Phaser.Game({ type: Phaser.CANVAS, parent: 'sheet', width: W, height: 3000, backgroundColor: '#0b0f17', scene: Sheet, banner: false });
