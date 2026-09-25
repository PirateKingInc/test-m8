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

## Phase 4: Mobile & art (done)

These shipped in Phase 4:
* touch controls alongside the unchanged mouse and keyboard (the action bar,
  tap, double-tap, Box, drag-pan, pinch-zoom and group hold)
* sprite art drawn in code: units, buildings in three construction states,
  crystals and terrain
* a visual reference sheet
* a tutorial for each input mode, what-you-can-do hints and phone layouts

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
- [P4] Mouse-wheel zoom on desktop. Pinch-zoom exists on touch, and the renderer already draws sprites larger when zoomed out, but desktop zoom was not added so that the desktop controls stayed unchanged.
- [P3] Settings panel (volume slider, edge-scroll toggle) and full key rebinding. Shift+digit, the HUD group bar and fullscreen Keyboard Lock cover the Ctrl+1–8 conflict.
- [P3] Save/restore sandbox state (JSON snapshot of `World`).
- [P3] Flow-field pathfinding if unit counts ever go far beyond 40.
- [P3] Shift-queued waypoints/commands (command queueing).
- [P3] Optional second tech tier (the hard cap is 2): e.g. an upgrade building that unlocks armor/damage upgrades.
- [P4] Building damage states and animated construction. Phase 4 draws three construction states; there's no damage look yet.
- [P3] Accessibility: colorblind-safe team palettes and bigger UI scale.
- [P3] Building rotation/footprint variety.
- [P3] Smarter formation slot assignment when a move target straddles an obstacle.
- [P4] **Real-device testing.** Phase 4's touch controls are verified in Playwright/Chromium mobile emulation (CDP touch events), not on physical phones. Open questions:
  - how iOS Safari handles gestures on the canvas
  - whether the tap sizes feel right to real fingers
  - how the notch and safe areas affect the layout
  - frame rate on real GPUs (also see "Real GPU frame-rate measurement")
- [P4] Build orders pull every selected Drone off mining, and they stay idle afterwards. A Drone can also be reassigned away from an unfinished site, stalling it. Both are sim rules, frozen in Phase 4. On a phone they're the first friction a new player hits: mobile playtests and the tutorial test both ran into them. A future change could send builders back to their crystal.
- [P4] Landscape phones show group slots 1–6 only; slots 7–9 are hidden to fit the bottom panel. Portrait shows all nine.
- [P3] Polish items from issue #59 that were not built: audio cues for supply-blocked, scout reports and wave-launched (the under-attack alarm exists); an on-building construction-progress ring and production-complete flash; a rally-point marker; an on-building queue progress bar (the HUD queue has one).
