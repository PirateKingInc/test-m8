// AI scripts (SPEC.md Phase 2 "Strategies"). Each is data the engine executes:
// an ordered opening, a macro loop and army thresholds. Phase 3 tunes these
// numbers without touching src/ai/engine.js.
//
// Build spots are tile offsets from the team's own Command Core top-left, written
// for the west base; the engine mirrors them for the east base.
export const SPOTS = {
  depot: [9, -1], depot2: [9, 5], depot3: [2, -6], depot4: [5, 10], depot5: [-3, -5],
  foundry: [6, 5], foundry2: [2, 8], foundry3: [6, -6],
  spire: [10, 4], spire2: [14, 0], spire3: [14, 6], spire4: [11, -4],
  core: [1, 7],
};

// Shared army-control numbers (SPEC.md Phase 2 "Engine loop").
export const ARMY = {
  rallyTiles: 9, // rally point this far from our Core toward the enemy
  homeRadius: 512, // px around our buildings that counts as "our base" (16 tiles)
  coreAssault: 250, // px: army this close to the enemy Core with no enemy units near attacks it directly
  maxFoundryQueue: 2,
};

export const STRATEGIES = {
  rush: {
    name: 'Rush',
    description: 'Fast aggression: minimal economy, cheap Strikers and Sparkers, early continuous attacks.',
    opening: [
      { train: 'drone' }, { build: 'depot' }, { train: 'drone' }, { build: 'foundry' },
      { train: 'striker' }, { train: 'striker' }, { train: 'drone' },
    ],
    workerTarget: 8,
    supplyBuffer: 2,
    depotSpots: ['depot', 'depot2', 'depot3'],
    composition: { striker: 3, sparker: 1 },
    maxFoundries: 3, // extra Foundries whenever Lumen floats above floatLumen
    floatLumen: 250,
    firstWave: 6,
    wave: 5,
    retreatBelow: null, // never retreats
    reinforce: true,
    reinforceMin: 3, // reinforcements leave home in groups of at least this many
    scoutAt: 30,
  },

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
    noMacro: true,
  },

  boom: {
    name: 'Economy-Boom',
    description: 'Extra Depots and gathering early, delayed military, then out-produces late.',
    opening: [
      { train: 'drone' }, { train: 'drone' }, { build: 'depot' }, { train: 'drone' }, { train: 'drone' },
      { build: 'depot', spot: 'depot2' }, { train: 'drone' }, { train: 'drone' }, { build: 'foundry' }, { train: 'drone' },
    ],
    workerTarget: 16,
    supplyBuffer: 3,
    depotSpots: ['depot', 'depot2', 'depot3', 'depot4', 'depot5'],
    structures: [
      { build: 'foundry', spots: ['foundry', 'foundry2', 'foundry3'], max: 2, minDrones: 12 },
      { build: 'depot', spots: ['depot', 'depot2', 'depot3', 'depot4'], max: 3, minDrones: 14 },
    ],
    composition: { striker: 2, sparker: 2, bulwark: 1, lancer: 1 },
    maxFoundries: 3, // late game: a third Foundry once Lumen floats
    floatLumen: 600,
    firstWave: 14,
    wave: 10,
    retreatBelow: 0.35,
    reinforce: false,
    scoutAt: 60,
  },

  // Fixed player-side script used by the strategy playthrough tests: a solid
  // defensive economy that never attacks, so each AI strategy must carry its
  // full build/train/attack sequence to win.
  sentinel: {
    name: 'Sentinel (test player script)',
    opening: [
      { train: 'drone' }, { build: 'depot' }, { train: 'drone' }, { build: 'foundry' },
      { train: 'drone' }, { build: 'spire' },
    ],
    workerTarget: 10,
    supplyBuffer: 3,
    depotSpots: ['depot', 'depot2', 'depot3'],
    composition: { striker: 1, sparker: 1, bulwark: 1, lancer: 1 },
    maxFoundries: 2,
    floatLumen: 400,
    firstWave: Infinity, // defends only
    wave: Infinity,
    retreatBelow: null,
    reinforce: false,
  },
};
