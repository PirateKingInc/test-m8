# Backlog

Ideas that came up and were **not** built. Each one is tagged with the phase
it belongs to. The out-of-scope list in PROJECT.md always wins, and nothing
here may bring back fog of war, extra factions, more than 2 tech tiers,
multiplayer, extra maps or adaptive AI.

## Phase 2: Scripted AI opponent (done)

These shipped in Phase 2: win/lose on the Command Core, the mirrored east start,
the population cap, AI scouting, the scripted AI grown from `test/bot.js`,
under-attack notifications, and the Ctrl+1–8 control-group fix. The ideas below
were not built, so they move to Phase 3.

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
- [P3] Key rebinding. Phase 2 fixed the Ctrl+1–8 conflict with Shift+digit, a HUD group bar and fullscreen Keyboard Lock, but full rebinding is still open.
- [P3] Smarter formation slot assignment when a move target straddles an obstacle. Units may get jostled in one-tile lanes; they settle, but not always exactly on their slot.
- [P3] Rendering: batch unit drawing into textures, or use sprite atlases generated at boot. The JS render cost is already only ~0.4 ms per frame with 40 units.
- [P3] Kiting micro for Sparkers (step back while reloading). This changes the Striker-vs-Sparker counter, so retest it. (Moved from P2.)
- [P3] Minimap with click-to-jump and alert pings. (Moved from P2; Space jumps to the last attack for now.)
- [P3] Hold-position and patrol commands for players and the Turtle AI. (Moved from P2.)
- [P3] Drones auto-flee or retaliate when attacked while gathering. (Moved from P2.)
- [P3] **Strategy balance.** Fairness runs show Economy-Boom is clearly the strongest script and Rush the weakest against a defending, reacting player: Rush loses to Boom at Hard timing in every variant tried. Rebalance the scripts, or the unit and building data, so that each strategy has a matchup it wins.
- [P3] **Side-bias audit.** Mirror matches are 47% west / 53% east over 108 games, but Boom mirrors lean 12/36 to the east. Candidate sources: unmirrored tie-breaks (placement spiral order, spawn ring scan, A* tie-breaking), id-order processing, and "keep right" chirality.
- [P3] AI expansion to the middle crystal fields. Scripts never expand, so long games run the home field dry.
- [P3] AI micro: focus fire, pulling damaged units back, and Spire-aware pathing when attacking.
- [P3] AI retargeting from scouted memory, for enemy Cores built away from the start location. Today it targets the start location.
- [P3] Grow the fairness harness into the Phase 3 AI-vs-AI balance matrix (all strategy pairs × tiers × more seeds), with result history.
- [P3] Tune sudden death. 30:00 on score rarely triggers except against purely passive play.
