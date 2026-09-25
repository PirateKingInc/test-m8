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

The Boom mirror's east skew is investigated and fixed in issue #56. This section
is filled in by that change.
