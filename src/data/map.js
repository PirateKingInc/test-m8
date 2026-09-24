// Map layout for Phase 1 (see SPEC.md "Map"). All coordinates are in tiles.
// Rectangles are [x, y, w, h]. Crystal nodes are 2x2 and hold `nodeAmount` Lumen.
export const MAP = {
  cols: 80,
  rows: 60,
  tile: 32,
  startingLumen: 250,
  nodeAmount: 1500,
  nodeSize: 2,

  rocks: [
    // Ridge A (x=30-31), chokepoints at y 18-23 and 36-41
    [30, 0, 2, 18], [30, 24, 2, 12], [30, 42, 2, 18],
    // Ridge B (x=52-53), gaps at y 0-5, 26-31, 54-59
    [52, 6, 2, 20], [52, 32, 2, 22],
    // Outcrops
    [14, 10, 4, 3], [12, 46, 5, 3], [40, 26, 4, 8], [62, 14, 3, 3], [64, 46, 4, 3],
  ],

  nodes: [
    // Home field
    [20, 21], [22, 24], [23, 27], [23, 30], [22, 33], [20, 36],
    // North-middle
    [38, 6], [41, 5], [44, 6], [41, 9],
    // South-middle
    [38, 50], [41, 52], [44, 50], [41, 48],
    // East
    [66, 24], [68, 27], [69, 30], [68, 33], [66, 36], [64, 30],
  ],

  start: {
    team: 1,
    core: [8, 27],
    drones: [[13, 27], [13, 28], [13, 29], [13, 30]],
  },
};
