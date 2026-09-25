#!/usr/bin/env node
// Strategy-vs-strategy batch runner (Phase 3). Every strategy vs every strategy
// (mirrors included) at every difficulty's timing, N seeded matches per cell.
//
//   node tools/balance.mjs --seeds 100 --out balance/after.json [--tiers hard] [--offset 0] [--workers 4] [--mirrors] [--strats rush,boom]
//
// Deterministic: the same seeds and code give identical results.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { jobsFor, runPool, aggregate, report, worstMatchup, worstSideSkew, TIERS } from './balance-lib.mjs';

const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] == null || all[i + 1].startsWith('--') ? true : all[i + 1]]] : acc), []));
const seeds = Number(args.seeds || 100);
const tiers = args.tiers ? args.tiers.split(',') : TIERS;
const strats = args.strats ? args.strats.split(',') : undefined;
const seedOffset = Number(args.offset || 0);
const workers = args.workers ? Number(args.workers) : undefined;
const out = args.out || 'balance/latest.json';

const mirrorsOnly = !!args.mirrors;
const jobs = jobsFor({ seeds, tiers, seedOffset, mirrorsOnly, ...(strats && { strats }) });
const t0 = Date.now();
let lastLog = 0;
const results = await runPool(jobs, {
  workers,
  onResult: (_r, done, total) => {
    if (Date.now() - lastLog > 30000 || done === total) {
      lastLog = Date.now();
      console.error(`${done}/${total} matches (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  },
});
const cells = aggregate(results);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ seeds, seedOffset, tiers, mirrorsOnly, generated: new Date().toISOString(), cells, results }, null, 1));
console.log(report(cells, { title: `${seeds} seeds per cell (offset ${seedOffset})` }));
const w = worstMatchup(cells), s = worstSideSkew(cells);
if (!mirrorsOnly) console.log(`\nWorst matchup: ${w.who} beats ${w.vs} ${Math.round(w.rate * 100)}% at ${w.tier} (95% CI ${Math.round(w.ci[0] * 100)}–${Math.round(w.ci[1] * 100)}%)`);
console.log(`Worst mirror side skew: ${s.strat} at ${s.tier}: west ${s.west} / east ${s.east} (${Math.round(s.skew * 100)}%, CI ${Math.round(s.ci[0] * 100)}–${Math.round(s.ci[1] * 100)}%)`);
console.log(`${jobs.length} matches in ${Math.round((Date.now() - t0) / 1000)}s -> ${out}`);
