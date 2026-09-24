# Backlog

Ideas that came up and were **not** built. Each one is tagged with the phase
it belongs to. The out-of-scope list in PROJECT.md always wins, and nothing
here may bring back fog of war, extra factions, more than 2 tech tiers,
multiplayer, extra maps or adaptive AI.

## Phase 2: Scripted AI opponent

- [P2] Win/lose condition: destroy all enemy buildings.
- [P2] AI opponent start position mirrored on the east side of the map (the east crystal field is already placed for it).
- [P2] Population/supply cap so a boom-style AI can't make unlimited units.
- [P2] Scouting: expose "what has the enemy built" queries in the sim for scripted reactions.
- [P2] Kiting micro for Sparkers (step back while reloading). This would change the Striker-vs-Sparker counter, so retest it.
- [P2] Minimap (click to jump, alert pings when under attack).
- [P2] Under-attack notifications and audio cue.
- [P2] Unit hold-position and patrol commands (helpful for turtle strategy AI & players).
- [P2] Drones auto-flee or auto-retaliate when attacked while gathering.

## Phase 3: Balance & polish

- [P3] Headless AI-vs-AI batch runner that uses the existing `World` API (fixed timestep and seeded RNG are already in place).
- [P3] Optional second tech tier (the hard cap is 2): e.g. an upgrade building that unlocks armor/damage upgrades.
- [P3] **Touch controls need real design work.** Box select, right-click commands and control groups have no obvious touch mapping. Phase 1 is desktop-only by decision.
- [P3] Camera zoom (mouse wheel) with level-of-detail rendering.
- [P3] Better building art, damage states and construction animation.
- [P3] Settings panel (volume slider, edge-scroll toggle, key rebinding).
- [P3] Accessibility: colorblind-safe team palettes and bigger UI scale.
- [P3] Flow-field pathfinding if unit counts ever go far beyond 40.
- [P3] Shift-queued waypoints/commands.
- [P3] Building rotation/footprint variety.
- [P3] Save/restore sandbox state (JSON snapshot of `World`).
