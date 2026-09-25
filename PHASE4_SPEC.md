# Phase 4 spec: touch controls, sprite art, clarity

Phase 4 is **controls and visuals only**. Everything in `src/data/`, `src/sim/`
and `src/ai/` is frozen at its Phase 3 state. `test/freeze.test.js` pins the
exact bytes of every file there, and pins fixed-seed match fingerprints, so any
change fails CI.

## 1. Input modes

Both schemes ship in the same build. Each pointer event is handled by the
scheme that produced it: `pointer.wasTouch` means touch, anything else means
mouse. The on-screen touch chrome (the action bar, bigger buttons and the
touch tutorial) appears once the device reports a coarse pointer
(`matchMedia('(pointer: coarse)')`) or the first touch arrives. It can be
forced with `?input=touch` or `?input=mouse`.

The desktop mouse and keyboard scheme is **unchanged**. For its controls, see
SPEC.md "Controls".

Both schemes feed the same `InputController` methods: `selectAt`, `selectBox`,
`command` (the contextual right-click order), `attackMoveTo`, `place`,
`assignGroup` and `recallGroup`. Those are the only code that calls
`world.issue()`. The touch layer (`src/game/touch.js`) only turns gestures
into calls to those methods.

## 2. The touch model

Right-click has no touch equivalent, and a long-press is invisible to a new
player. So orders go through an **explicit, always-visible action bar**.

| Touch | Action | Desktop equivalent |
|---|---|---|
| **Tap** a unit or building | Select it. What is exactly under the finger wins first (a unit, then a building or crystal). Only then does a finger-sized radius (22 screen px) apply, so a Drone walking across a Foundry can't steal a tap aimed at the Foundry. | Left-click |
| **Tap** empty ground | Deselect | Left-click |
| **Double-tap** own unit | Select every own unit of that type that is on screen | – (new) |
| **One-finger drag** | Pan the camera | Arrow keys, screen edge, middle-drag |
| **Pinch** | Zoom the camera, from 0.5× to 1.6× | – (new) |
| **▭ Box** button, then drag | Box-select own units (Box stays armed for that one drag) | Left-drag |
| **➜ Order** button, then tap | The contextual order at the tapped spot: move, attack an enemy, gather a crystal, help build, return cargo, or set the rally point with a Core or Foundry selected | Right-click |
| **⚔ Attack-move** button, then tap | Attack-move there | A, then left-click |
| **■ Stop** | Stop | S |
| **⌂ Base** | Center the camera on the Command Core | Home |
| Group bar **tap** / **press and hold (0.5 s)** | Recall / assign a control group (tap twice to center the camera) | 1–9 / Shift+1–9 |
| Command card button, then **touch and release** on the map | Place a building. The ghost follows the finger and the building is placed where the finger lifts. **✕ Cancel** cancels. | Q/W/E/R, then click |
| Command card (Core/Foundry) | Train | Q/W/E/R |
| Tap the under-attack toast | Jump the camera to the attack | Space |

**The armed state is obvious.** While Order or Attack-move is armed:
- The button glows.
- A banner at the top says what the next tap will do, for example
  "Tap where to move, or an enemy to attack".
- Each selected unit gets a pulsing ring.

The next tap fires the order and disarms. Tapping the button again or
**✕ Cancel** disarms without an order. **Order** is only enabled when the
selection holds something it can command; it pulses once when the selection
first becomes commandable, to be discovered.

**Why Box is a mode.** A one-finger drag already has to pan: on a phone the
map is always bigger than the screen, and there is no screen edge or middle
button to pan with. A second meaning for the same gesture would be ambiguous
and unreliable. Double-tap covers the common "grab my army" case.

**Layout.**
- **Landscape phones** (e.g. 844×390): the action bar is a column on the right
  edge.
- **Portrait phones:** it becomes a row above the bottom panel.
- **Tap targets** are at least 44×44 CSS px.

## 3. Art direction

**Style.** A clean, slightly chunky top-down sci-fi look with dark
outlines. Every sprite is drawn by code onto an off-screen canvas at startup
and registered as a Phaser texture. There are no image files, and no art comes
from a CDN.

**Where the code lives.**
- `src/art/palette.js`: colours
- `src/art/units.js`: unit sprites
- `src/art/buildings.js`: building sprites
- `src/art/terrain.js`: crystals and terrain
- `src/art/atlas.js`: bakes the textures

These modules only draw. The game layer (`src/game/sprites.js`) places the
textures on entities each frame.

**Palette.**
- **Base colours:** a dark slate ground, warm grey rock and violet Lumen
  crystals.
- **Team 1 (player): teal `#39d3c3`.** Team 2 (AI): orange `#ff7a45`. Team
  colour covers the main hull or roof of every unit and building, plus a
  ground ring under each unit, so teams stay distinct at low zoom. The two
  colours differ in hue and in brightness.

**Units.** Each unit has its own silhouette and size that survives at 0.5×
zoom. Sprites rotate to face their heading.

| Unit | Silhouette |
|---|---|
| Drone | Round hull with two glowing rotor rings and a cargo pod that shows violet crystal when carrying. It is deliberately "cute": the only unit with visible rotors. |
| Striker | Sleek arrowhead with two forward blades |
| Sparker | Diamond hull with a long glowing emitter and a yellow core |
| Bulwark | The biggest unit: wide armoured body with a bright shield plate |
| Lancer | Round body carrying a very long golden lance cannon |

**Buildings.** Each building has its own roof shape, drawn in three
construction states:

| State | When | Looks like |
|---|---|---|
| Foundation | under 34% built | Outlined pad and scattered blocks |
| Frame | 34–99% built | Scaffold girders around a half-height structure |
| Complete | finished | The full building |

| Building | Roof |
|---|---|
| Command Core | Hexagonal dome with a bright central light |
| Depot | Silo ring holding a crystal |
| Foundry | Factory with chimneys and a glowing furnace |
| Sentry Spire | Tall turret seen from above, with a barrel |

**Crystals and terrain.**
- **Crystals** are drawn as clusters of faceted shards, and shrink in three
  steps as they are mined.
- **Terrain** is baked once from code: a noisy ground, then ridge and outcrop
  rock with shading and a lit edge, so walls read as raised.

**Gameplay size is unchanged.** Sprites may be drawn larger than the gameplay
footprint, but hit radius, footprint, picking and pathing all still come from
the unchanged data. `test/freeze.test.js` pins them.

**Reference sheet.** `tools/sheet.html` shows every unit and building (each
construction state), for both teams, at in-game zoom levels 1.0× and 0.5×.
`node tools/reference-sheet.mjs` saves it as `docs/reference-sheet.png` for
manual review.

## 4. Clarity (intentionally light)

- **Two tutorials.** The first-run tutorial has a touch version and a mouse
  version, picked by input mode. The touch hints name the action bar ("Tap ➜
  Order, then tap a crystal"). The steps are the same six.
- **A selection panel.** It shows what is selected and what it can do. A
  one-line hint appears per selection type, for example "Drone: tap a build
  button, or ➜ Order to mine".
- **The top bar on a phone.** Lumen and supply stay large and always visible.
  Secondary items (FPS, the opponent label) are hidden on narrow screens.

## 5. Verification

1. **Regression.** The full Phase 1–3 suite still passes. `test/freeze.test.js`
   pins the bytes of `src/data`, `src/sim` and `src/ai`, and pins fixed-seed
   match fingerprints.
2. **Touch tests.** `e2e/touch.spec.js` runs in Playwright mobile emulation
   (touch, 844×390). It covers select, double-tap, box, move, attack, gather,
   attack-move, stop, groups, pan, pinch zoom and building placement.
3. **Collision.** Fixed-seed fingerprints (positions, HP, orders) of the
   Phase 3 bot fight and matches are unchanged. Taps pick exactly what the
   sim's `pickAt` picks at the same world point.
4. **Visual distinctness.** The reference sheet (`docs/reference-sheet.png`)
   is for manual review. A test checks each baked texture is distinct from
   every other.
5. **Bots.** The bot test and the full bot-vs-bot match still pass.
6. **Mobile bot playthrough.** `e2e/mobile-playthrough.spec.js` runs as its own
   CI job (`npm run test:mobile`). It plays a whole match against the Easy AI
   using nothing but touch events on screen positions, and plays it to a
   declared result.

   The test asserts:
   - the Depot, Foundry and Spire were placed by dragging
   - an army of at least 10 units was trained
   - armed Order and Attack orders were used in a fight
   - a group was assigned by holding its slot
   - a pinch was used

   **It does not assert a win.** This simple scripted player loses to the Easy
   AI, and the loss comes from its strategy and its action rate (each touch
   action costs game time), not from a missing control.
