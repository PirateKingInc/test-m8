// Fairness harness (SPEC.md Phase 2 "Fairness protocol"): scripted player-side
// policies vs each difficulty tier over fixed seeds. Deterministic by seed.
import { PF } from '../helpers.js';
import { Match } from '../../src/ai/match.js';
import { DIFFICULTY } from '../../src/data/difficulty.js';

export const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

export const POLICIES = {
  competent: { strategy: 'boom', difficulty: 'hard' },
  intermediate: { strategy: 'turtle', difficulty: 'easy' },
  novice: { strategy: 'rush', difficulty: 'easy' },
};

// Player (team 1) win rate for one policy against one tier's default strategy.
export function winRate(tier, policy) {
  let wins = 0, losses = 0, draws = 0;
  const times = [];
  for (const seed of SEEDS) {
    const m = new Match({ seed, PF, ai: { strategy: 'auto', difficulty: tier }, player: POLICIES[policy] });
    const r = m.runToEnd();
    times.push(Math.round(r.time));
    if (r.winner === 1) wins++; else if (r.winner === 2) losses++; else draws++;
  }
  const rate = wins / SEEDS.length;
  console.error(`# ${DIFFICULTY[tier].name.padEnd(6)} AI (${DIFFICULTY[tier].strategy}) vs ${policy.padEnd(12)}: player wins ${wins}/${SEEDS.length} (${Math.round(rate * 100)}%), AI ${losses}, draws ${draws}; median length ${times.sort((a, b) => a - b)[6]}s`);
  return rate;
}

// Required thresholds (player win rate).
export const REQUIRE = {
  competentMin: { easy: 0.75, normal: 0.5, hard: 0.1 },
  noviceMax: 0.5,
  hardBeatsIntermediate: 0.75, // i.e. intermediate player wins at most 25% vs Hard
};
