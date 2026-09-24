import { PLAYER } from '../sim/constants.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';

const nameOf = (e) => (e.kind === 'unit' ? UNITS[e.type].name : e.kind === 'building' ? BUILDINGS[e.type].name : 'Lumen Crystal');

// DOM HUD overlay. Reads world state; never mutates it.
export class Hud {
  constructor(doc = document) {
    this.el = {
      lumen: doc.getElementById('lumen'),
      units: doc.getElementById('unit-count'),
      fps: doc.getElementById('fps'),
      selection: doc.getElementById('selection-panel'),
    };
    this.lastRefresh = 0;
  }

  update(world, fps, ui) {
    const now = performance.now();
    if (now - this.lastRefresh < 100) return;
    this.lastRefresh = now;
    let units = 0;
    for (const u of world.ofKind('unit')) if (u.team === PLAYER) units++;
    this.el.lumen.textContent = Math.floor(world.resources[PLAYER]);
    this.el.units.textContent = units;
    this.el.fps.textContent = `${Math.round(fps)} fps`;
    if (ui) this.el.selection.innerHTML = this.selectionHtml(world, ui.selection.entities(world));
  }

  selectionHtml(world, sel) {
    if (!sel.length) return '<span class="dim">Nothing selected. Left-click or drag to select; right-click to command.</span>';
    if (sel.length === 1) {
      const e = sel[0];
      const stat = e.kind === 'node' ? `${Math.ceil(e.amount)} / ${e.maxAmount} Lumen`
        : `HP ${Math.ceil(e.hp)} / ${e.maxHp}${e.kind === 'unit' ? ` · ${e.order.type}` : ''}${e.carry ? ` · carrying ${e.carry}` : ''}`;
      const team = e.team && e.team !== PLAYER ? ' <span class="enemy">(test target team)</span>' : '';
      return `<div class="sel-name">${nameOf(e)}${team}</div><div class="dim">${stat}</div>`;
    }
    const counts = {};
    for (const e of sel) counts[nameOf(e)] = (counts[nameOf(e)] || 0) + 1;
    return `<div class="sel-name">${sel.length} selected</div><div class="dim">${Object.entries(counts).map(([n, c]) => `${n} ×${c}`).join(' · ')}</div>`;
  }
}
