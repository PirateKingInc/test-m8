// Batch-runner helpers: job lists, a child-process pool, aggregation and reports.
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';

export const STRATS = ['rush', 'boom', 'turtle'];
export const TIERS = ['easy', 'normal', 'hard'];

// Every unordered strategy pair (mirrors included) x tier x seed; mirrorsOnly
// keeps only the same-strategy cells, for side-bias checks.
export function jobsFor({ seeds, tiers = TIERS, strats = STRATS, seedOffset = 0, mirrorsOnly = false }) {
  const jobs = [];
  for (const tier of tiers) {
    for (let i = 0; i < strats.length; i++) {
      for (let k = i; k < strats.length; k++) {
        if (mirrorsOnly && k !== i) continue;
        for (let s = 1; s <= seeds; s++) jobs.push({ a: strats[i], b: strats[k], tier, seed: s + seedOffset });
      }
    }
  }
  return jobs;
}

export function runPool(jobs, { workers = Math.max(1, availableParallelism() - 0), onResult = () => {} } = {}) {
  const url = new URL('./balance-worker.mjs', import.meta.url);
  const chunks = Array.from({ length: Math.min(workers, jobs.length) }, () => []);
  // Round-robin so every worker gets a similar mix of short and long matches.
  jobs.forEach((j, i) => chunks[i % chunks.length].push(j));
  const results = [];
  return Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
    const child = fork(url, [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('message', (msg) => {
      if (msg.result) { results.push(msg.result); onResult(msg.result, results.length, jobs.length); }
      if (msg.done) { child.kill(); resolve(); }
    });
    child.on('error', reject);
    child.on('exit', (code) => { if (code && code !== 0 && code !== null) reject(new Error(`worker exited ${code}`)); });
    child.send({ jobs: chunk });
  }))).then(() => results.sort((x, y) => (x.tier + x.a + x.b + String(x.seed).padStart(6)).localeCompare(y.tier + y.a + y.b + String(y.seed).padStart(6))));
}

// 95% Wilson score interval for k successes out of n.
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// Per (tier, a, b) cell: wins for a, b, draws, and west/east wins.
export function aggregate(results) {
  const cells = {};
  for (const r of results) {
    const key = `${r.tier}|${r.a}|${r.b}`;
    const c = (cells[key] ||= { tier: r.tier, a: r.a, b: r.b, n: 0, a_wins: 0, b_wins: 0, draws: 0, west: 0, east: 0, timeLimit: 0, totalTime: 0 });
    c.n++;
    if (r.winner === 'a') c.a_wins++; else if (r.winner === 'b') c.b_wins++; else c.draws++;
    if (r.side === 'west') c.west++; else if (r.side === 'east') c.east++;
    if (r.reason === 'time-limit') c.timeLimit++;
    c.totalTime += r.time;
  }
  return cells;
}

const pct = (x) => `${Math.round(x * 100)}%`;

// Markdown: per tier, a row-vs-column win-rate matrix (row strategy's win rate;
// the diagonal shows the mirror's west-side win rate), then a side-bias table.
export function report(cells, { title = 'Results' } = {}) {
  const lines = [`### ${title}`, ''];
  const names = { rush: 'Rush', boom: 'Boom', turtle: 'Turtle' };
  for (const tier of TIERS) {
    const tierCells = Object.values(cells).filter((c) => c.tier === tier);
    if (!tierCells.length) continue;
    lines.push(`**${tier[0].toUpperCase() + tier.slice(1)} timing** (row's win rate vs column; diagonal = mirror, west side's win rate)`, '');
    lines.push(`| | ${STRATS.map((s) => names[s]).join(' | ')} |`, `|---|${STRATS.map(() => '---').join('|')}|`);
    for (const row of STRATS) {
      const cols = STRATS.map((col) => {
        const c = tierCells.find((x) => (x.a === row && x.b === col) || (x.a === col && x.b === row));
        if (!c) return '–';
        if (row === col) return `${pct(c.west / c.n)} west (n=${c.n})`;
        const wins = c.a === row ? c.a_wins : c.b_wins;
        const [lo, hi] = wilson(wins, c.n);
        return `**${pct(wins / c.n)}** (${pct(lo)}–${pct(hi)})`;
      });
      lines.push(`| **${names[row]}** | ${cols.join(' | ')} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// The largest win rate of any strategy against a different strategy.
export function worstMatchup(cells) {
  let worst = { rate: 0 };
  for (const c of Object.values(cells)) {
    if (c.a === c.b) continue;
    for (const [who, wins] of [[c.a, c.a_wins], [c.b, c.b_wins]]) {
      const rate = wins / c.n;
      if (rate > worst.rate) worst = { rate, who, vs: who === c.a ? c.b : c.a, tier: c.tier, n: c.n, ci: wilson(wins, c.n) };
    }
  }
  return worst;
}

// The largest side skew in any mirror cell: max(west, east) / decided games.
export function worstSideSkew(cells) {
  let worst = { skew: 0 };
  for (const c of Object.values(cells)) {
    if (c.a !== c.b) continue;
    const decided = c.west + c.east;
    const skew = decided ? Math.max(c.west, c.east) / decided : 0;
    if (skew > worst.skew) worst = { skew, strat: c.a, tier: c.tier, west: c.west, east: c.east, ci: wilson(Math.max(c.west, c.east), decided) };
  }
  return worst;
}
