// Difficulty tiers (SPEC.md Phase 2 "Difficulty"). Difficulty picks the default
// strategy and how tightly its script is timed; it never makes the AI smarter.
export const DIFFICULTY = {
  easy: {
    name: 'Easy', strategy: 'boom',
    decisionInterval: 2.5, // s between engine decisions
    stepDelay: 6, // s of extra idle time after each opening step
    reactionDelay: 25, // s before a scouting trigger takes effect
    workerFactor: 0.7, // x the strategy's worker target
  },
  normal: {
    name: 'Normal', strategy: 'turtle',
    decisionInterval: 1.2, stepDelay: 2, reactionDelay: 10, workerFactor: 0.9,
  },
  hard: {
    name: 'Hard', strategy: 'rush',
    decisionInterval: 0.5, stepDelay: 0, reactionDelay: 3, workerFactor: 1.0,
  },
};
