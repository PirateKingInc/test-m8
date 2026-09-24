# Prism Outpost

A mini real-time strategy **sandbox** that runs in the browser. This is Phase 1 of 3.
You can build a base, mine Lumen crystals, train units and fight test targets. There
is no opponent yet; see [PROJECT.md](PROJECT.md) for the roadmap and scope.

**Play:** https://piratekinginc.github.io/test-m8/ (desktop, mouse and keyboard)

It's a static site with no build step. [Phaser 3](https://phaser.io) and
[PathFinding.js](https://github.com/qiao/PathFinding.js) load from the jsDelivr CDN.
All art is drawn in code, and all audio is synthesized with the Web Audio API.

## Controls

| Input | Action |
|---|---|
| Left-click / Shift+click | Select, or add to / remove from the selection |
| Left-drag | Box-select your units (Shift adds) |
| Right-click | Context command: move in formation, **attack** an enemy or test target, **gather** a crystal (Drones), return cargo at a Depot, help build an unfinished building. With a Core or Foundry selected, it sets the rally point. |
| **A**, then left-click | Attack-move |
| **S** | Stop |
| **Shift+1–9** (or Ctrl+1–9) | Assign a control group. Desktop Chrome swallows Ctrl+1–8 for tab switching, so Shift is the primary key. The **Fullscreen** button turns on Keyboard Lock so Ctrl works too, and the HUD group bar assigns on right-click or Shift-click. |
| **1–9** / click a group slot | Select a control group (press twice to center the camera) |
| **Q W E R** with a Drone selected | Place a Command Core, Lumen Depot, Foundry or Sentry Spire. Left-click places it, Shift+click places several, and Esc or right-click cancels. |
| **Q** with the Core selected | Train a Drone |
| **Q W E R** with the Foundry selected | Train a Striker, Sparker, Bulwark or Lancer |
| Click a queue slot / **Backspace** | Cancel that item / the last queued item (100% refund) |
| **X** | Cancel an unfinished building (75% refund) |
| Arrow keys, screen edge, middle-drag | Pan the camera. **Home** recenters on the Core. |
| **M** | Mute or unmute |
| **\`** (backtick) | Dev panel. It spawns **test targets** and team-2 test units, for verification only. |

## Roster

The single resource is **Lumen**. Drones mine 8 Lumen per 2 s trip at a crystal and carry it to a **Lumen Depot**; the Core is not a drop-off.

| Unit | Role | HP | Armor | Damage / cooldown | Range | Speed | Cost | Train |
|---|---|---|---|---|---|---|---|---|
| Drone | worker | 40 | light | 4 blade / 1.0 s | melee | 72 | 50 | 10 s (Core) |
| Striker | light melee | 100 | light | 10 blade / 0.6 s | melee | 85 | 60 | 12 s (Foundry) |
| Sparker | ranged | 65 | light | 15 bolt / 0.75 s | 176 | 70 | 70 | 14 s (Foundry) |
| Bulwark | heavy | 300 | heavy | 14 crush / 1.0 s | melee | 50 | 150 | 22 s (Foundry) |
| Lancer | anti-heavy | 120 | light | 26 lance / 1.4 s | 128 | 60 | 110 | 18 s (Foundry) |

| Building | Size | HP | Cost | Build | Role |
|---|---|---|---|---|---|
| Command Core | 4×4 | 1500 | 400 | 60 s | Base; trains Drones |
| Lumen Depot | 3×3 | 600 | 100 | 20 s | Resource drop-off |
| Foundry | 3×3 | 800 | 150 | 30 s | Trains combat units |
| Sentry Spire | 2×2 | 500 | 120 | 25 s | Turret: 14 bolt / 0.8 s, 224 range |

**Counters:**
- A Striker beats a Sparker up close, and a Sparker beats a Striker at range.
- A Bulwark beats both of them.
- A Lancer beats a Bulwark.
- Strikers and Sparkers both beat Lancers.

The full damage table is in [SPEC.md](SPEC.md).

## Run locally

```bash
npm install          # dev dependencies only (tests); the game itself needs nothing
npm run serve        # http://localhost:8080 (or open index.html via any static server)
```

## Tests

```bash
npm test             # headless sim tests (node --test)
npm run test:e2e     # Playwright browser tests (npx playwright install chromium first)
```

CI runs both on every push and PR. Every merge to `main` runs the tests, deploys to
GitHub Pages, and polls the live URL until it serves that exact commit.

| Suite | What it proves |
|---|---|
| `test/pathfinding.test.js` | Units route around rock, buildings and blocked or unreachable goals, and nobody stays stuck forever |
| `test/stress.test.js` | 40 units cross the map, 20 vs 20 cross head-on through a chokepoint, and 35 units handle 6 random orders. All arrive with no lasting overlap, at about 0.2 ms per sim step. |
| `test/economy.test.js`, `test/production.test.js`, `test/construction.test.js` | The gather rate matches the spec formula, costs, build times, FIFO queues and refunds |
| `test/counters.test.js` | Each counter row is checked with 50 seeded 1v1s (≥ 80% required, and each currently wins 100%) |
| `test/selection.test.js`, `e2e/selection.spec.js`, `e2e/combat.spec.js` | Drag-box, control groups, formation moves, attack and attack-move |
| `test/bot.test.js` | A scripted bot builds every building, trains one of each unit, and beats a squad of test targets |

The headless tests load the exact PathFinding.js bundle the CDN serves, so they exercise the library build that ships.
