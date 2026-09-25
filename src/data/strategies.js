// AI scripts (SPEC.md Phase 2 "Strategies"). Each is data the engine executes:
// an ordered opening, a macro loop and army thresholds. Phase 3 tunes these
// numbers without touching src/ai/engine.js.
//
// Build spots are tile offsets from the team's own Command Core top-left, written
// for the west base; the engine mirrors them for the east base.
export const SPOTS = {
  depot: [9, -1], depot2: [9, 5], depot3: [2, -6],
  foundry: [6, 5], foundry2: [2, 8],
  spire: [10, 4], spire2: [14, 0], spire3: [14, 6], spire4: [11, -4],
  core: [1, 7],
};

export const STRATEGIES = {
  // The Phase 1 sandbox bot's behaviour, now expressed as a script: one of every
  // building, one of every unit, no attack. test/bot.test.js runs it.
  sandbox: {
    name: 'Sandbox bot',
    opening: [
      { train: 'drone' }, { build: 'depot' }, { train: 'drone' },
      { build: 'foundry' }, { build: 'spire' }, { build: 'core' },
      { train: 'striker' }, { train: 'sparker' }, { train: 'bulwark' }, { train: 'lancer' },
    ],
    workerTarget: 0, // no macro loop: the opening is the whole script
    composition: {},
  },
};
