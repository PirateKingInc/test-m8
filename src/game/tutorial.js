// First-run tutorial (Phase 3): a short, non-blocking sequence of hints that
// advance as the player does each thing. Shown until finished or skipped; the
// "done" flag lives in localStorage (guarded: storage may be unavailable).
import { PLAYER } from '../sim/constants.js';

const KEY = 'prism-tutorial-v1';

// Even reading window.localStorage can throw (blocked storage, some privacy modes).
function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
const COMBAT = new Set(['striker', 'sparker', 'bulwark', 'lancer']);
const mine = (w, kind, type) => [...w.ofKind(kind)].filter((e) => e.team === PLAYER && (!type || e.type === type));

export const STEPS = [
  { id: 'select', text: 'Drag a box around your <b>Drones</b> (or click one) to select them.',
    done: (w, ui) => ui.selection.entities(w).some((e) => e.team === PLAYER && e.type === 'drone') },
  { id: 'gather', text: '<b>Right-click a purple crystal</b> to mine Lumen. Drones carry it to a Depot.',
    done: (w) => mine(w, 'unit', 'drone').some((d) => d.order.type === 'gather') },
  { id: 'depot', text: 'With a Drone selected, press <kbd>W</kbd> and click to place a <b>Lumen Depot</b> near the crystals.',
    done: (w) => mine(w, 'building', 'depot').length > 0 },
  { id: 'foundry', text: 'Press <kbd>E</kbd> with a Drone selected to build a <b>Foundry</b>, where combat units are trained.',
    done: (w) => mine(w, 'building', 'foundry').length > 0 },
  { id: 'train', text: 'Select the finished Foundry and press <kbd>Q</kbd>–<kbd>R</kbd> to train units. Hover a button for its counters.',
    done: (w) => mine(w, 'unit').some((u) => COMBAT.has(u.type)) },
  { id: 'attack', text: 'Select your army, press <kbd>A</kbd> and click to attack-move (or right-click an enemy). <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>9</kbd> saves a group.',
    done: (w) => mine(w, 'unit').some((u) => COMBAT.has(u.type) && (u.order.type === 'attack' || u.order.type === 'attackMove')) },
];

export class Tutorial {
  constructor({ storage = safeStorage(), render = () => {}, onAdvance = () => {}, match = true } = {}) {
    this.storage = storage;
    this.render = render;
    this.onAdvance = onAdvance;
    this.match = match;
    this.step = 0;
    let seen = false;
    try { seen = storage?.getItem(KEY) === 'done'; } catch { /* storage unavailable: show the tutorial */ }
    this.active = !seen;
    if (this.active) this.render(this.view());
  }

  view() {
    if (!this.active) return null;
    if (this.step >= STEPS.length) {
      return { index: STEPS.length, total: STEPS.length, final: true,
        text: this.match ? 'That\'s the loop! <b>Destroy the enemy Command Core</b> in the east before it destroys yours.' : 'That\'s the loop! Press <kbd>`</kbd> for the dev panel to spawn test targets.' };
    }
    return { index: this.step + 1, total: STEPS.length, text: STEPS[this.step].text };
  }

  // Call regularly with the world and the input controller.
  update(world, ui) {
    if (!this.active || this.step >= STEPS.length) return;
    let moved = false;
    // Skip ahead past anything the player already did.
    while (this.step < STEPS.length && STEPS[this.step].done(world, ui)) { this.step++; moved = true; }
    if (moved) { this.onAdvance(this.step); this.render(this.view()); }
  }

  finish() {
    this.active = false;
    try { this.storage?.setItem(KEY, 'done'); } catch { /* storage unavailable: it just shows again next time */ }
    this.render(null);
  }

  static reset(storage = safeStorage()) {
    try { storage?.removeItem(KEY); } catch { /* ignore */ }
  }
}
