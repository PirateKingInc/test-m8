# Prism Outpost — Project Overview

A small real-time strategy game that runs in the browser as a static site
(Phaser + PathFinding.js from a CDN, no build step, all art and audio made in code).

**Read this first if you are picking the project up in a new session.** It
covers the whole project, lists what is out of scope, and describes the
counter design every phase relies on. Phase-specific numbers are in
[SPEC.md](SPEC.md). Ideas we postponed are in [BACKLOG.md](BACKLOG.md).

## Fixed design pillars (all phases)

- **One faction.** The player and any future opponent use the same units and
  buildings. There are no asymmetric races.
- **One map.** There is no fog of war: the whole map is always visible.
- **One resource**, *Lumen*. Drones gather it from fixed crystal nodes and
  carry it back to a Lumen Depot, which adds it to the stockpile.
- **Four buildings:** Command Core (base, trains Drones), Lumen Depot
  (drop-off), Foundry (the one unit-production building) and Sentry Spire
  (defensive turret). Each has a cost and a construction time.
- **Five unit types with clear counters.** They are listed in the table below.
- Original theme, names and art. We use no existing IP.

## Phases

| Phase | Goal | Status |
|---|---|---|
| **1 — Sandbox** | A playable sandbox with base building, gathering, production queues, unit control, pathfinding with steering, and combat that follows the counter design. **No AI opponent** and no win/lose condition. Neutral *test targets* exist only for verification and are not a game feature. Shipped to GitHub Pages. | this phase |
| **2 — Scripted AI opponent** | An opponent that plays with the same rules and roster. It picks one of three scripted strategies (**rush**, **economy boom**, **turtle-and-tech**) and reacts to what it scouts. For example, it builds Lancers after seeing Bulwarks, or adds Spires after seeing an early rush. This phase adds the win/lose condition (destroy all enemy buildings). | future |
| **3 — Balance & polish** | Headless simulated matches between the strategies to tune the unit and building data. Then polish: UX, feedback, performance and accessibility. | future |

## Explicitly OUT OF SCOPE for the whole project

Do not add any of these in any phase. They were ruled out on purpose to keep
the project small:

- Fog of war or any vision/line-of-sight mechanic
- More than one faction or asymmetric races
- Deep tech trees. There are **at most 2 tech tiers, ever**. Phase 1 has one tier.
- Multiplayer, networking or lockstep netcode
- More than one map, map editors or procedural maps
- Adaptive or learning AI (ML, self-play training, online adaptation). The
  Phase 2 AI is scripted.

Any other idea goes into `BACKLOG.md`, tagged with the phase it belongs to.
Ideas are not built on the side.

## Counter relationships (design contract)

Each attack type deals a percentage of its damage to each armor class:

| Attack type ↓ / Armor → | light | heavy | structure |
|---|---|---|---|
| blade (Drone, Striker) | 100% | 40% | 50% |
| bolt (Sparker, Sentry Spire) | 100% | 40% | 50% |
| crush (Bulwark) | 100% | 60% | 100% |
| lance (Lancer) | 35% | 250% | 150% |

The intended 1v1 results below are verified by simulated fights in
`test/counters.test.js`:

| Matchup | Winner | Why |
|---|---|---|
| Striker vs Sparker, **starting in melee range** | **Striker** | The Striker's burst kills the fragile Sparker (65 HP) in 7 hits (3.6 s). The Sparker needs 4.5 s. |
| Striker vs Sparker, **starting at Sparker range** | **Sparker** | The Striker spends about 2 s closing the gap while the Sparker shoots freely. |
| Bulwark vs Striker | **Bulwark** | Heavy armor takes only 40% of blade damage. |
| Bulwark vs Sparker | **Bulwark** | Heavy armor takes only 40% of bolt damage. |
| Lancer vs Bulwark | **Lancer** | The lance deals 250% damage to heavy armor and kills in 5 hits. |
| Striker vs Lancer | **Striker** | The lance deals only 35% to light armor, and the Lancer fires slowly. |
| Sparker vs Lancer | **Sparker** | The Sparker outranges the Lancer (176 vs 128), which also deals only 35% to light armor. |
| Any combat unit vs Drone | **combat unit** | Drones are workers. |

In short: the **Striker** beats the Sparker up close and beats the Lancer.
The **Sparker** beats the Striker at range and beats the Lancer. The
**Bulwark** beats both Striker and Sparker. The **Lancer** beats the
Bulwark. Every unit has at least one counter.

## Architecture (all phases)

- `index.html` loads Phaser 3 and PathFinding.js from jsDelivr, then
  `src/game/main.js` as an ES module.
- `src/data/*.js`: readable data for units, buildings and the map.
- `src/sim/*.js`: **pure game logic** with no Phaser or DOM code. It uses a
  fixed timestep (`SIM_DT = 0.05 s`) and a seeded RNG, so it runs headless in
  Node for tests and in the future for Phase 2 and 3 simulations. The world
  is changed only through commands (`world.issue(cmd)`), which is the same
  API the UI, the tests and a future AI use.
- `src/game/*.js`: the Phaser scene (rendering and input), the DOM HUD and
  Web Audio. It only reads sim state and sends commands.
- `test/*.test.js`: `node --test`. Unit, economy, counter, pathfinding and
  stress tests, plus a scripted bot (`test/bot.js`) that plays the whole loop
  through the command API. Phase 2's AI will drive the same `world.issue()` API.
  `test/e2e/*.spec.js` has Playwright browser smoke tests.
- CI is GitHub Actions: tests run on every push and PR. Merging to `main`
  deploys to GitHub Pages.

## Working agreement

Each vertical slice gets a GitHub Issue with acceptance criteria. Each slice
then goes through branch, PR, green CI, self-review, merge and issue close.
Never merge a PR with red CI. PRs over about 400 lines are split.
