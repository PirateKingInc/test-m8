// Win / lose (SPEC.md Phase 2): a team with no completed Command Core is defeated;
// same-tick mutual loss is a draw; at the time limit the higher score wins.
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';

export const TEAMS = [1, 2];

export function hasCore(world, team) {
  for (const b of world.ofKind('building')) if (b.team === team && b.type === 'core' && b.built && b.hp > 0) return true;
  return false;
}

// Banked Lumen + cost of living units + cost of standing buildings (paid in full on placement).
export function score(world, team) {
  let s = world.resources[team] || 0;
  for (const e of world.entities.values()) {
    if (e.team !== team) continue;
    if (e.kind === 'unit') s += UNITS[e.type].cost;
    else if (e.kind === 'building') s += BUILDINGS[e.type].cost;
  }
  return s;
}

function finish(world, winner, reason) {
  const loser = winner === null ? null : TEAMS.find((t) => t !== winner);
  world.result = { winner, loser, reason, time: world.time, scores: Object.fromEntries(TEAMS.map((t) => [t, score(world, t)])) };
  world.emit('gameOver', { ...world.result });
}

// Called at the end of every match-mode step. Always leaves a declared result
// once a Core is gone or time runs out, so a match can never end in limbo.
export function checkResult(world) {
  if (world.mode !== 'match' || world.result) return;
  const alive = TEAMS.filter((t) => hasCore(world, t));
  if (alive.length === 0) return finish(world, null, 'draw');
  if (alive.length === 1) return finish(world, alive[0], 'core-destroyed');
  if (world.time >= world.map.timeLimit - 1e-9) {
    const [a, b] = TEAMS.map((t) => score(world, t));
    return finish(world, a === b ? null : a > b ? 1 : 2, 'time-limit');
  }
}
