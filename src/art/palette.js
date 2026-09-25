// The Phase 4 palette: one set of colours for every sprite, so the game reads
// as one designed style. See PHASE4_SPEC.md "Art direction".
export const TEAM = {
  1: { base: '#39d3c3', light: '#9ff5ea', dark: '#1d7f78', glow: '#c8fff8' }, // player: teal
  2: { base: '#ff7a45', light: '#ffc09f', dark: '#a8431e', glow: '#ffe2cf' }, // AI: orange
};

export const INK = '#0b0f17'; // outlines
export const METAL = { base: '#6b7788', light: '#aeb9c8', dark: '#3a4250', deep: '#232a35' };
export const LUMEN = { base: '#b69bff', light: '#e4d8ff', dark: '#6a4fd0', glow: 'rgba(182, 155, 255, 0.35)' };
export const WARM = { base: '#ffc24a', light: '#fff0b8', dark: '#b07a10' }; // lance, furnace, construction
export const GROUND = { base: '#19212d', mottle: ['#1c2533', '#172029', '#1e2837'], grid: 'rgba(60, 78, 104, 0.18)' };
export const ROCK = { base: '#4a4f5c', light: '#7c8292', dark: '#2a2e37', face: '#1e2128', crack: '#353a45' };
export const HAZARD = { yellow: '#ffd24a', black: '#1a1a1a' };

// Hex colour -> Phaser integer.
export const hex = (c) => parseInt(c.slice(1), 16);
