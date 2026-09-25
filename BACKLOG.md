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

## Phase 3: Balance & polish (done)

These shipped in Phase 3:
* the strategy-vs-strategy batch runner (`tools/balance.mjs`) and a tuned
  strategy matrix (see BALANCE.md)
* the side-bias root-cause fix
* AI expansion to the middle fields and attacks on the scouted Core
* per-tier execution handicaps (a Foundry cap)
* the audio pass, visual juice, result-screen stats, tooltips and the
  first-run tutorial

## Post-project (not scheduled)

The project's three phases are complete. These ideas were deliberately not
built. They are tagged `[P3]` because they were raised in, or deferred to,
Phase 3.

- [P3] **Uniform balance at Hard.** At Hard timing, Turtle beats Rush about 80% of the time (81% pooled over 200 seeds; see BALANCE.md). The Foundry cap also leaves Turtle beating Rush at Easy and Normal. Three strategies form a rock-paper-scissors triangle: across several tuning passes, fixing that cell reliably broke another. Fixing it for real likely needs a new lever, such as Sparker kiting or AI micro, or a fourth strategy, not more tuning of the same numbers.
- [P3] **Real GPU frame-rate measurement.** CI and the dev container only have headless software GL (about 12 fps with 40 units). The sim and render budgets are measured per step and per frame instead. This is a known, accepted limitation of the environment.
- [P3] Kiting micro for Sparkers (step back while reloading). This changes the Striker-vs-Sparker counter, so retest it.
- [P3] Minimap with click-to-jump and alert pings. Space jumps to the last attack for now.
- [P3] Hold-position and patrol commands for players and the Turtle AI.
- [P3] Drones auto-flee or retaliate when attacked while gathering.
- [P3] AI micro: focus fire, pulling damaged units back, and Spire-aware pathing when attacking.
- [P3] **Touch controls need real design work.** Box select, right-click commands and control groups have no obvious touch mapping. The game is desktop-only by decision.
- [P3] Camera zoom (mouse wheel) with level-of-detail rendering.
- [P3] Settings panel (volume slider, edge-scroll toggle) and full key rebinding. Shift+digit, the HUD group bar and fullscreen Keyboard Lock cover the Ctrl+1–8 conflict.
- [P3] Save/restore sandbox state (JSON snapshot of `World`).
- [P3] Flow-field pathfinding if unit counts ever go far beyond 40.
- [P3] Shift-queued waypoints/commands (command queueing).
- [P3] Optional second tech tier (the hard cap is 2): e.g. an upgrade building that unlocks armor/damage upgrades.
- [P3] Better building art, damage states and construction animation.
- [P3] Accessibility: colorblind-safe team palettes and bigger UI scale.
- [P3] Building rotation/footprint variety.
- [P3] Smarter formation slot assignment when a move target straddles an obstacle.
- [P3] Rendering: batch unit drawing into textures, or use sprite atlases generated at boot.
- [P3] Polish items from issue #59 that were not built: audio cues for supply-blocked, scout reports and wave-launched (the under-attack alarm exists); an on-building construction-progress ring and production-complete flash; a rally-point marker; an on-building queue progress bar (the HUD queue has one).
