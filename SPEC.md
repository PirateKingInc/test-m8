# Phase 1 Spec: Sandbox

This file has the exact numbers for Phase 1. The code reads them from
`src/data/units.js`, `src/data/buildings.js` and `src/data/map.js`. If you
change a number here, change it there too; `test/data.test.js` checks that
the key values match.

Conventions: 1 tile = 32 px. Speeds are in px/s. Times are in seconds.
*Range* is the **edge-to-edge gap** between the two footprints (unit
circles and building rectangles). The simulation runs at a fixed
`SIM_DT = 0.05 s` (20 Hz). The renderer interpolates between steps.

## Resources

| Item | Value |
|---|---|
| Resource | **Lumen** (one type) |
| Starting stockpile | **250** |
| Crystal node | 2×2 tiles, **1500** Lumen each, blocks movement, disappears when empty |
| Drone carry | **8** Lumen per trip |
| Mining time | **2.0 s** at the node (the Drone must be within 8 px of the node edge) |
| Drop-off | instant when within 8 px of a **completed Lumen Depot** (the Command Core is *not* a drop-off) |
| Loop | node → nearest depot → same node. If that node is empty, the Drone moves to the nearest node within 12 tiles, or goes idle if there is none. |

Expected income per Drone ≈ `8 / (2.0 + roundTripPx / 72)` Lumen/s.
`test/economy.test.js` checks this within ±15%.

## Units

| id | Name | Role | HP | Armor | Attack | Damage | Cooldown | Range | Speed | Radius | Cost | Train time | Trained at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| drone | Drone | worker | 40 | light | blade | 4 | 1.0 | 8 | 72 | 9 | 50 | 10 | Command Core |
| striker | Striker | light melee | 100 | light | blade | 10 | 0.6 | 8 | 85 | 11 | 60 | 12 | Foundry |
| sparker | Sparker | ranged | 65 | light | bolt | 15 | 0.75 | 176 | 70 | 10 | 70 | 14 | Foundry |
| bulwark | Bulwark | heavy | 300 | heavy | crush | 14 | 1.0 | 8 | 50 | 15 | 150 | 22 | Foundry |
| lancer | Lancer | anti-heavy specialist | 120 | light | lance | 26 | 1.4 | 128 | 60 | 11 | 110 | 18 | Foundry |

- Each hit deals `damage × multiplier(attack, armor) × U(0.9, 1.1)`. The
  random factor comes from the seeded RNG.
- Combat units auto-acquire enemies within **200 px** gap when idle or
  attack-moving. Drones never auto-acquire, but they attack when ordered.
- A chase ends when the target dies or the gap grows past **320 px**.
- Test targets and test units (verification only) belong to team 2.

### Damage multipliers

| Attack ↓ / Armor → | light | heavy | structure |
|---|---|---|---|
| blade | 1.00 | 0.40 | 0.50 |
| bolt | 1.00 | 0.40 | 0.50 |
| crush | 1.00 | 0.60 | 1.00 |
| lance | 0.35 | 2.50 | 1.50 |

### Counter table

`test/counters.test.js` checks each row with **N = 50** seeded fights. The
intended winner must win **at least 80%** of them.

| # | Matchup (A vs B) | Start gap | Intended winner | Nominal time to kill (A→B / B→A) |
|---|---|---|---|---|
| 1 | Striker vs Sparker | 4 px (melee) | Striker | 3.6 s / 4.5 s |
| 2 | Striker vs Sparker | 176 px (Sparker range) | Sparker | ≈2.0 + 3.6 s / 4.5 s |
| 3 | Bulwark vs Striker | 4 px and 176 px | Bulwark | 7.0 s / 44 s |
| 4 | Bulwark vs Sparker | 4 px and 176 px | Bulwark | 4.0 s (+3 s closing) / 36.8 s |
| 5 | Lancer vs Bulwark | 4 px and 128 px | Lancer | 5.6 s / 8.0 s |
| 6 | Striker vs Lancer | 4 px and 128 px | Striker | 6.6 s / 14 s |
| 7 | Sparker vs Lancer | 4 px and 176 px | Sparker | 5.25 s / 9.8 s |
| 8 | each combat unit vs Drone | 4 px | combat unit | — |

## Buildings

| id | Name | Footprint | HP | Armor | Cost | Build time | Function |
|---|---|---|---|---|---|---|---|
| core | Command Core | 4×4 | 1500 | structure | 400 | 60 | Trains Drones. The player starts with one. |
| depot | Lumen Depot | 3×3 | 600 | structure | 100 | 20 | Resource drop-off |
| foundry | Foundry | 3×3 | 800 | structure | 150 | 30 | Trains Striker, Sparker, Bulwark and Lancer |
| spire | Sentry Spire | 2×2 | 500 | structure | 120 | 25 | Defensive turret: bolt 14 dmg, 0.8 s cooldown, 224 px range |

- **Placement** follows the tile grid. A spot is valid only when every
  footprint tile is inside the map and free of rock, other buildings and
  crystal nodes. Units standing on a new footprint are pushed to the nearest
  free tile.
- **Construction:** the cost is paid when the site is placed. The ordering
  Drone walks to the site. Progress advances only while at least one Drone
  is building next to it (gap ≤ 8 px). Extra builders do not speed it up.
  HP grows from 10% to 100% of max as the site progresses. Cancelling an
  unfinished site refunds **75%**.
- **Production queue:** up to **5** items per building. The cost is paid
  when an item is queued, and items train one at a time in FIFO order.
  Cancelling any queued item, including the one in progress, refunds
  **100%**. A trained unit appears on the nearest free tile next to the
  building and walks to the rally point if one is set.
- No debt is allowed. Costs are paid up front (on placement or on queueing),
  and a command that costs more than the stockpile is rejected with an
  "insufficient Lumen" cue.

## Map (`src/data/map.js`)

- **80 × 60 tiles** (2560 × 1920 px), which is larger than one screen.
- **Player start:** Command Core at tile (8,27). Four Drones at tiles
  (13,27)–(13,30). The camera starts centered on the Core.
- **Rock (impassable):**
  - Ridge A at x=30–31: y 0–17, 24–35 and 42–59. The gaps at y 18–23 and
    36–41 are chokepoints.
  - Ridge B at x=52–53: y 6–25 and 32–53. The gaps are y 0–5, 26–31 and 54–59.
  - Outcrops at (14,10) 4×3, (12,46) 5×3, (40,26) 4×8, (62,14) 3×3 and (64,46) 4×3.
- **Crystal nodes (20 × 1500 Lumen):**
  - Home field: (20,21), (22,24), (23,27), (23,30), (22,33) and (20,36)
  - North-middle: (38,6), (41,5), (44,6) and (41,9)
  - South-middle: (38,50), (41,52), (44,50) and (41,48)
  - East: (66,24), (68,27), (69,30), (68,33), (66,36) and (64,30)

## Movement & pathfinding

- **Library:** PathFinding.js 0.4.18 (`PF.AStarFinder`) routes on the 80×60 tile
  grid. Diagonals are allowed only when no corner is cut (`allowDiagonal` +
  `dontCrossCorners`; the CDN browser bundle uses these legacy option names).
  Headless tests load that exact CDN bundle.
- **Smoothing:** the A* tile path is string-pulled greedily. A shortcut is kept
  only if a band **±12 px** either side of the segment is walkable, so units
  don't hug rock corners. Intermediate waypoints count as reached within
  **12 px**; the final one within 2 px.
- **Blocked or unreachable goals** resolve to the nearest walkable tile, or to
  the nearest tile *reachable* from the unit (found by BFS flood fill).
- **Group moves keep the group's shape.** Each unit aims at `goal + (its
  offset from the group centroid)`. The offsets are compressed to about
  `0.75·√n` tiles if the group is spread out. Each target then snaps to the
  nearest free walkable tile, so every unit gets a distinct destination and
  paths rarely cross.
- **Separation (spatial hash, 2 passes per tick):**
  - Overlapping units push apart.
  - A moving unit shoves an idle one **sideways**, off its heading, rather than
    bulldozing it.
  - Movers meeting roughly head-on each sidestep to their **right**.
  - Moving-vs-moving collisions are **soft** (25% of the overlap is resolved per
    tick), so crowds flow through chokepoints. Idle units separate fully.
  - Drones on the gather loop pass through each other.
  - A settled unit drifts back to where it stopped if it gets jostled up to 96 px.
  - Positions never enter blocked tiles; units slide along walls.
- **Stuck recovery:**
  - Progress is measured as the shrinkage of the remaining path length, so a
    unit jostled back and forth doesn't count as moving.
  - Less than 4 px of progress in 1.0 s triggers a re-plan. Every 0.5 s a unit
    also re-plans if it has been pushed behind an obstacle relative to its next
    waypoint.
  - Re-plans while pressed against moving traffic don't count as failures, for
    up to 15 s of waiting. After 3 counted failures the unit stops, so it is
    never stuck forever.
- **Performance budget:** 40 units moving at once must average **< 5 ms per sim
  step** in CI (`test/stress.test.js`). They currently average about 0.2 ms.

## Controls

| Input | Action |
|---|---|
| Left-click | Select a unit or building (Shift = add or remove) |
| Left-drag | Box-select your own units (Shift = add) |
| Right-click enemy / test target | Attack it |
| Right-click crystal (with Drones) | Gather |
| Right-click Depot (with carrying Drones) | Return cargo |
| Right-click own unfinished building (with Drones) | Help construct |
| Right-click ground | Move in formation. With a Core or Foundry selected, this sets the rally point. |
| **A** then left-click | Attack-move (engage enemies met on the way) |
| **S** | Stop |
| **Ctrl + 1–9** (or **Shift + 1–9**) | Assign a control group. Desktop Chrome reserves Ctrl+1–8 for switching tabs, so Shift is the reliable choice there. |
| **1–9** | Select a control group (press twice to center the camera on it) |
| **Q W E R** (Drone selected) | Place a Command Core, Depot, Foundry or Sentry Spire. Left-click places it, and Esc or right-click cancels. |
| **Q** (Core selected) | Train a Drone |
| **Q W E R** (Foundry selected) | Train a Striker, Sparker, Bulwark or Lancer |
| Click a queue slot / **Backspace** | Cancel that item / the last queued item (full refund) |
| **X** (unfinished building selected) | Cancel construction (75% refund) |
| Arrow keys, screen-edge mouse, middle-drag | Pan the camera |
| **Home** | Center the camera on the Command Core |
| **M** | Mute or unmute |
| **\`** (backtick) | Toggle the dev panel. It spawns **test targets** and team-2 test units for verification. This is not a game feature. |

## Verification

1. **Pathfinding** (`test/pathfinding.test.js`, `test/stress.test.js`):
   units route around rocks and buildings, and no unit stays stuck. 40 units
   crossing the map finish within the time budget without lasting overlap.
2. **Economy** (`test/economy.test.js`, `test/production.test.js`): the
   gathering rate matches the formula, costs are deducted, queues run in
   FIFO order, and cancels refund correctly.
3. **Counters** (`test/counters.test.js`): N=50 fights per row of the counter table.
4. **Selection and control** (`test/selection.test.js`, `test/e2e`):
   box-select, control groups and attack-move.
5. **Bot sandbox** (`test/bot.test.js`): a scripted bot builds every
   building, trains one of each unit and wins a fight against test targets.
