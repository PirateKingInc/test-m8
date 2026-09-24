// Building roster (see SPEC.md "Buildings"). Footprints are in tiles.
export const BUILDINGS = {
  core: {
    name: 'Command Core', w: 4, h: 4, hp: 1500, armor: 'structure',
    cost: 400, buildTime: 60, trains: ['drone'], hotkey: 'Q', supply: 10,
  },
  depot: {
    name: 'Lumen Depot', w: 3, h: 3, hp: 600, armor: 'structure',
    cost: 100, buildTime: 20, trains: [], dropOff: true, hotkey: 'W', supply: 8,
  },
  foundry: {
    name: 'Foundry', w: 3, h: 3, hp: 800, armor: 'structure',
    cost: 150, buildTime: 30, trains: ['striker', 'sparker', 'bulwark', 'lancer'], hotkey: 'E',
  },
  spire: {
    name: 'Sentry Spire', w: 2, h: 2, hp: 500, armor: 'structure',
    cost: 120, buildTime: 25, trains: [], hotkey: 'R',
    weapon: { attack: 'bolt', damage: 14, cooldown: 0.8, range: 224 },
  },
};

export const BUILD_ORDER = ['core', 'depot', 'foundry', 'spire'];

export const CONSTRUCTION = {
  startHpFraction: 0.1,
  cancelRefund: 0.75,
  builderRange: 8,
};

export const PRODUCTION = {
  maxQueue: 5,
  cancelRefund: 1.0,
};

// Population cap (SPEC.md Phase 2 "Population (supply)"). Applies to every team.
export const SUPPLY = {
  max: 60, // hard ceiling, however many providers a team has
};
