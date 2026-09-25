// Difficulty tiers (SPEC.md Phase 2 "Difficulty"). Difficulty picks the default
// strategy and how tightly its script is timed; it never makes the AI smarter.
// Default strategies follow their measured strength (test/fairness): Rush is the
// weakest script against a defending player, Economy-Boom the strongest.
export const DIFFICULTY = {
  easy: {
    name: 'Easy', strategy: 'rush',
    decisionInterval: 2.5, // s between engine decisions
    stepDelay: 2, // s of extra idle time after each opening step
    reactionDelay: 25, // s before a scouting trigger takes effect
    workerFactor: 0.7, // x the strategy's worker target
    jitter: 0.3, // +/- share of random slack on each decision and step delay (seeded)
  },
  normal: {
    name: 'Normal', strategy: 'turtle',
    decisionInterval: 1.2, stepDelay: 2, reactionDelay: 10, workerFactor: 0.9, jitter: 0.2,
  },
  hard: {
    name: 'Hard', strategy: 'boom',
    decisionInterval: 0.5, stepDelay: 0, reactionDelay: 3, workerFactor: 1.0, jitter: 0.1,
  },
};
