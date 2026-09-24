// Population cap (SPEC.md Phase 2 "Population (supply)"). Pure functions of world
// state, identical for every team: the rule lives in the sim, not in the AI.
import { UNITS } from '../data/units.js';
import { BUILDINGS, SUPPLY } from '../data/buildings.js';

// Supply used = living units + production already queued (reserved on enqueue).
export function supplyUsed(world, team) {
  let used = 0;
  for (const e of world.entities.values()) {
    if (e.team !== team) continue;
    if (e.kind === 'unit') used += UNITS[e.type].supply;
    else if (e.kind === 'building') for (const q of e.queue) used += UNITS[q.unit].supply;
  }
  return used;
}

// Cap = completed providers' supply, clamped to the hard maximum.
export function supplyCap(world, team) {
  let cap = 0;
  for (const b of world.ofKind('building')) {
    if (b.team === team && b.built) cap += BUILDINGS[b.type].supply || 0;
  }
  return Math.min(cap, SUPPLY.max);
}

export function supplyOf(world, team) {
  const used = supplyUsed(world, team), cap = supplyCap(world, team);
  return { used, cap, free: cap - used };
}
