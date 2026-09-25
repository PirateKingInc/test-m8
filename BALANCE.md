# Balance report (Phase 3)

This file records how the three AI strategies fare against each other, before
and after Phase 3 tuning, and how the Economy-Boom mirror's side bias was found
and fixed. Every number here comes from the headless batch runner and is
reproducible: the sim is deterministic, so the same code and seeds give the same
results on any machine.

## How the matrix is measured

```bash
node tools/balance.mjs --seeds 100 --out balance/latest.json            # full matrix, 1,800 matches
node tools/balance.mjs --seeds 150 --mirrors --out balance/mirrors.json  # mirror matches only
node tools/balance.mjs --seeds 100 --offset 1000 --tiers hard            # a disjoint seed set, one tier
```

- **Cells.** Each unordered strategy pair, mirrors included, is played at each
  difficulty's timing, with **both sides on that tier**. That gives 6 pairs × 3
  tiers.
- **Seeds and sides.** Seeds run 1..N. Odd seeds put the row strategy in the
  west and even seeds put it in the east, so each off-diagonal cell is played
  equally from both sides and side bias cancels out.
- **Diagonal cells.** A mirror has no row/column winner, so the diagonal shows
  the **west side's** win rate. It is the side-bias measurement.
- **Confidence.** Brackets are 95% Wilson score intervals.
- **Speed.** The runner forks one worker per CPU. The full 1,800-match matrix
  takes about 12 minutes on the 4-CPU development container.
- **Raw data.** Every per-match result (winner, side, end reason, time and
  scores) is saved as JSON in `balance/`.

## Baseline: Phase 2 data (before tuning)

`balance/baseline.json` holds this run: 100 seeds per cell, 1,800 matches, on
the Phase 2 code at the start of Phase 3.

**Easy timing** (row's win rate vs column; diagonal = mirror, west side's win rate)

| | Rush | Boom | Turtle |
|---|---|---|---|
| **Rush** | 50% west | **0%** (0–4%) | **0%** (0–4%) |
| **Boom** | **100%** (96–100%) | 27% west | **100%** (96–100%) |
| **Turtle** | **100%** (96–100%) | **0%** (0–4%) | 60% west |

**Normal timing**

| | Rush | Boom | Turtle |
|---|---|---|---|
| **Rush** | 54% west | **0%** (0–4%) | **0%** (0–4%) |
| **Boom** | **100%** (96–100%) | 33% west | **97%** (92–99%) |
| **Turtle** | **100%** (96–100%) | **3%** (1–8%) | 55% west |

**Hard timing**

| | Rush | Boom | Turtle |
|---|---|---|---|
| **Rush** | 54% west | **0%** (0–4%) | **0%** (0–4%) |
| **Boom** | **100%** (96–100%) | 26% west | **94%** (88–97%) |
| **Turtle** | **100%** (96–100%) | **6%** (3–12%) | 57% west |

**What the baseline shows:**

- **A strict hierarchy, not a triangle.** Boom beats Turtle, which beats Rush,
  and Boom also beats Rush. Every cross-strategy cell is 94–100% one way. The
  60% ceiling is broken in all 9 cross cells.
- **Rush never wins.** Its first wave of 6 light units reaches a base that is
  already reacting to the early aggression: Turtle behind two Sentry Spires,
  Boom with a bigger economy. Both win the fight at home and then out-produce
  Rush.
- **Boom mirrors lean east** at every tier: 27%, 33% and 26% west. Over 300
  games that is 86 west to 214 east. See [Side bias](#side-bias) below.
- **Match length.** Rush-vs-X games end at about 6 minutes. Turtle games run
  11–13 minutes. The 30:00 time limit decided just 5 of 1,800 games, all of
  them Turtle mirrors.

## Side bias

### Finding

In the baseline, Boom mirrors went **86 west / 214 east** over 300 games: 27%,
33% and 26% west by tier. Rush and Turtle mirrors stayed within noise.

The map is an exact mirror image and both sides run the same script, so a skew
this large meant **some rule in the sim wasn't mirror-symmetric**.

### Method: the mirror trace

- **Setup.** Run a mirror match with the AI's timing jitter set to 0 and
  compare every tick: team 1's state against the mirror image of team 2's
  (units, buildings and Lumen).
- **What divergence means.** In a symmetric sim the two stay identical forever.
  The first tick where they differ points at the asymmetric rule.
- **The loop.** Fix that rule, re-run, and find the next divergence. This took
  the first divergence from **10 s** to 69 s, then 77 s, then (without the
  scout) about 120 s. What remains is float rounding (0.01 px) plus the
  scouts' exact head-on meeting at mid-map, an inherently symmetric tie.

### Root causes, fixed

1. **Spawn side.** A building with no rally point spawned units at its
   bottom-*right* corner on both sides. For the west base that faces the
   field; for the east base it faces away, into its own back corner. Boom
   trains 12+ Drones, so it felt this most. East now mirrors the west
   (bottom-left).
2. **Keep-right steering.** Movers meeting head-on both sidestepped to their
   own right, which is chirality, not symmetry: a mirrored pair should step in
   mirror image. They now step away from the side the other unit is on.
3. **Tie-break order.** These searches all broke ties west-to-east on both
   sides:
   - the spiral that picks the nearest free tile (formation slots, gather and
     build approach)
   - the BFS for the nearest reachable tile
   - the AI's building-placement search
   - A*'s choice between equal-cost paths

   The east half now searches in the mirror-image order, and east-half units
   plan paths in a mirrored frame (flip, plan with the west-half code, flip
   back).

West-side behaviour is unchanged from Phase 1: the sandbox bot's fight still
finishes in 42.9 s with the same survivors. `test/sidebias.test.js` locks each
fix in: spiral, path and spawn equivariance, plus a 90 s exact-mirror check for
each strategy. Against the pre-fix code, all 6 of its tests fail.

### Result: mirror matches after the fix

`balance/mirrors-after.json`: 150 seeds per strategy per tier, 1,350 matches.

| West win rate | Rush | Boom | Turtle |
|---|---|---|---|
| Easy | 47% (70/80) | 49% (74/76) | 53% (79/71) |
| Normal | 48% (72/78) | **50% (75/75)** | 57% (85/65) |
| Hard | 50% (75/75) | 51% (76/74) | 49% (73/77) |
| **All tiers** | 48% | **50% (225/225)** | 53% |

- **Boom.** It went from 86/214 to **225/225**.
- **Overall.** Across all 1,350 mirrors it's 679 west / 671 east.
- **The one cell above 55%.** Turtle at Normal was 85/65, and its 95%
  interval (49–64%) includes 50%. I re-ran it on 300 disjoint seeds (151–450)
  and got **150/150**. Over 450 games that's 235/215 (52%), so the 57% was
  sampling noise.
- **Effect on the fairness table.** The Phase 2 competent player runs as team
  1 (west). Against Hard (Boom) it rose from 25% to 58% once the west side
  was no longer handicapped. The table still holds: competent beats every
  tier, novice loses at every tier, and win rates fall from Easy to Hard.
