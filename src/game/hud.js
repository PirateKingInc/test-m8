import { PLAYER } from '../sim/constants.js';
import { supplyOf } from '../sim/supply.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';

const nameOf = (e) => (e.kind === 'unit' ? UNITS[e.type].name : e.kind === 'building' ? BUILDINGS[e.type].name : 'Lumen Crystal');

// DOM HUD overlay. Reads world state; never mutates it.
export class Hud {
  constructor(doc = document) {
    this.el = {
      lumen: doc.getElementById('lumen'),
      units: doc.getElementById('unit-count'),
      supply: doc.getElementById('supply'),
      fps: doc.getElementById('fps'),
      selection: doc.getElementById('selection-panel'),
      card: doc.getElementById('command-card'),
      toast: doc.getElementById('toast'),
      sound: doc.getElementById('sound'),
    };
    this.cardSig = '';
    this.groupsEl = doc.getElementById('groups');
    this.groupsSig = '';
    this.groupsEl.innerHTML = Array.from({ length: 9 }, (_, i) => `<button data-group="${i + 1}"><b>${i + 1}</b><span></span></button>`).join('');
    const slot = (ev) => ev.target.closest('button[data-group]');
    this.groupsEl.addEventListener('click', (ev) => {
      const b = slot(ev);
      if (!b || !this.ui) return;
      if (ev.shiftKey || ev.ctrlKey) this.ui.assignGroup(Number(b.dataset.group));
      else this.ui.recallGroup(Number(b.dataset.group));
    });
    this.groupsEl.addEventListener('contextmenu', (ev) => {
      const b = slot(ev);
      ev.preventDefault();
      if (b && this.ui) this.ui.assignGroup(Number(b.dataset.group));
    });
    const fs = doc.getElementById('fullscreen');
    fs.addEventListener('click', () => enterFullscreenWithKeyLock(doc));
    doc.addEventListener('fullscreenchange', () => { fs.textContent = doc.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
    this.dev = doc.getElementById('dev-panel');
    doc.addEventListener('keydown', (ev) => { if (ev.code === 'Backquote') this.dev.hidden = !this.dev.hidden; });
    this.dev.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-spawn]');
      if (btn && this.ui) { this.ui.devSpawn = btn.dataset.spawn; this.ui.attackMode = false; this.ui.placing = null; }
    });
    this.el.selection.addEventListener('click', (ev) => {
      const slot = ev.target.closest('[data-cancel]');
      if (slot) this.ui?.action(`cancel-train:${slot.dataset.cancel}`);
    });
    this.el.card.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (btn && !btn.disabled) this.ui?.action(btn.dataset.action);
    });
    this.lastRefresh = 0;
  }

  // Victory / Defeat / Draw screen (SPEC.md Phase 2 "Win / lose").
  showResult(r, doc = document) {
    this.shownResult = true;
    const title = r.winner === null ? 'Draw' : r.winner === PLAYER ? 'Victory' : 'Defeat';
    const why = { 'core-destroyed': r.winner === PLAYER ? 'The enemy Command Core is destroyed.' : 'Your Command Core was destroyed.',
      draw: 'Both Command Cores fell at the same moment.', 'time-limit': `Time limit reached: decided on score (${r.scores[1]} vs ${r.scores[2]}).` }[r.reason];
    const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, '0');
    doc.getElementById('result-title').textContent = title;
    doc.getElementById('result-title').className = title.toLowerCase();
    doc.getElementById('result-detail').textContent = `${why} Match time ${mm}:${ss}.`;
    doc.getElementById('result').hidden = false;
    doc.getElementById('play-again').onclick = () => location.reload();
    doc.getElementById('change-difficulty').onclick = () => { location.search = ''; };
  }

  setMuted(muted) {
    this.el.sound.textContent = muted ? 'Sound off (M)' : 'Sound on (M)';
  }

  toast(text) {
    if (!text) return;
    const el = this.el.toast;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the fade animation
    el.classList.add('show');
  }

  update(world, fps, ui) {
    const now = performance.now();
    if (now - this.lastRefresh < 100) return;
    this.lastRefresh = now;
    let units = 0;
    for (const u of world.ofKind('unit')) if (u.team === PLAYER) units++;
    this.el.lumen.textContent = Math.floor(world.resources[PLAYER]);
    this.el.units.textContent = units;
    const sup = supplyOf(world, PLAYER);
    this.el.supply.textContent = `${sup.used}/${sup.cap}`;
    this.el.supply.classList.toggle('blocked', sup.free <= 0);
    this.el.fps.textContent = `${Math.round(fps)} fps`;
    if (world.result && !this.shownResult) this.showResult(world.result);
    if (!ui) return;
    this.ui = ui;
    this.updateGroups(world, ui);
    // Only touch the DOM when content changes, so buttons stay clickable.
    const sel = ui.selection.entities(world);
    const html = this.selectionHtml(world, sel);
    if (html !== this.selHtml) { this.selHtml = html; this.el.selection.innerHTML = html; }
    const bar = this.el.selection.querySelector('.queue i');
    const q = sel.length === 1 && sel[0].queue?.[0];
    if (bar && q) bar.style.width = `${Math.floor((q.progress / UNITS[q.unit].trainTime) * 100)}%`;
    const card = ui.commandCard();
    const sig = JSON.stringify(card);
    if (sig !== this.cardSig) {
      this.cardSig = sig;
      this.el.card.innerHTML = card.map((b) => `<button data-action="${b.action}" ${b.enabled ? '' : 'disabled'} class="${b.active ? 'active' : ''}" title="${b.label} (${b.key})">`
        + `<span class="key">${b.key}</span>${b.label}${b.cost != null ? `<span class="cost">${b.cost}</span>` : ''}</button>`).join('');
    }
  }

  updateGroups(world, ui) {
    const counts = Array.from({ length: 9 }, (_, i) => (ui.groups.groups.get(i + 1) || []).filter((id) => world.get(id)?.hp > 0).length);
    const sig = counts.join(',');
    if (sig === this.groupsSig) return;
    this.groupsSig = sig;
    this.groupsEl.querySelectorAll('button').forEach((b, i) => {
      b.querySelector('span').textContent = counts[i] ? `×${counts[i]}` : '';
      b.classList.toggle('empty', !counts[i]);
    });
  }

  queueHtml(e) {
    if (e.kind !== 'building' || !e.queue?.length) return '';
    // The first slot's progress bar is updated in place by update().
    return `<div class="queue">${e.queue.map((q, i) => `<button data-cancel="${i}" title="Cancel (full refund)">${UNITS[q.unit].name}${i === 0 ? '<i></i>' : ''}</button>`).join('')}</div>`;
  }

  selectionHtml(world, sel) {
    if (!sel.length) return '<span class="dim">Nothing selected. Left-click or drag to select; right-click to command.</span>';
    if (sel.length === 1) {
      const e = sel[0];
      const stat = e.kind === 'node' ? `${Math.ceil(e.amount)} / ${e.maxAmount} Lumen`
        : `HP ${Math.ceil(e.hp)} / ${e.maxHp}${e.kind === 'unit' ? ` · ${e.order.type}` : ''}${e.carry ? ` · carrying ${e.carry}` : ''}`;
      const team = e.team && e.team !== PLAYER ? ' <span class="enemy">(test target team)</span>' : '';
      const building = e.kind === 'building' && !e.built ? ` · building ${Math.floor(e.progress * 100)}%` : '';
      return `<div class="sel-name">${nameOf(e)}${team}</div><div class="dim">${stat}${building}</div>${this.queueHtml(e)}`;
    }
    const counts = {};
    for (const e of sel) counts[nameOf(e)] = (counts[nameOf(e)] || 0) + 1;
    return `<div class="sel-name">${sel.length} selected</div><div class="dim">${Object.entries(counts).map(([n, c]) => `${n} ×${c}`).join(' · ')}</div>`;
  }
}

// Fullscreen plus the Keyboard Lock API: in Chrome this makes Ctrl+1-9 reach the
// page instead of switching tabs. Where either API is missing it fails quietly.
export async function enterFullscreenWithKeyLock(doc = document) {
  try {
    if (doc.fullscreenElement) { await doc.exitFullscreen(); return false; }
    await doc.documentElement.requestFullscreen();
    const keys = Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`);
    await globalThis.navigator?.keyboard?.lock?.(keys);
    return true;
  } catch {
    return false;
  }
}
