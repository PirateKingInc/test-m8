// Child process: prints one tier's player-policy win rates as JSON on stdout.
import { winRate, POLICIES } from './harness.js';

const tier = process.argv[2];
const rates = Object.fromEntries(Object.keys(POLICIES).map((p) => [p, winRate(tier, p)]));
process.stdout.write(`RESULT ${JSON.stringify(rates)}\n`);
