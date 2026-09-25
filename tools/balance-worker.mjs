// Child process: runs the jobs it is sent and streams one JSON result per line.
import { playMatch } from './match-runner.mjs';

process.on('message', ({ jobs }) => {
  for (const j of jobs) process.send({ result: playMatch(j.a, j.b, j.tier, j.seed) });
  process.send({ done: true });
});
