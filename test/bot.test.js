// End-to-end proof: a scripted bot builds a full base, produces one of each unit
// type, and wins a fight against test targets, using only world.issue().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, runUntil } from './helpers.js';
import { SandboxBot } from './bot.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { UNITS } from '../src/data/units.js';

test('sandbox bot: full base, one of each unit, then beats a squad of test targets', () => {
  const w = makeWorld({ seed: 2024 });
  const bot = new SandboxBot(w);
  let spent = 0;
  const trained = [];
  const built = [];
  for (let t = 0; t < 900 * 20; t++) {
    if (t % 10 === 0) bot.think();
    w.step();
    for (const e of w.drainEvents()) {
      if (e.type === 'trained') trained.push(e.unit);
      if (e.type === 'built') { built.push(e.building); spent += BUILDINGS[e.building].cost; }
    }
    if (bot.army().length === 4 && built.length === 4) break;
  }
  console.log(`# bot build phase done at ${w.time.toFixed(0)}s sim:\n#   ${bot.log.join('\n#   ')}`);
  assert.deepEqual([...built].sort(), ['core', 'depot', 'foundry', 'spire'], 'built one of every building');
  for (const unit of ['drone', 'striker', 'sparker', 'bulwark', 'lancer']) assert.ok(trained.includes(unit), `trained a ${unit}`);
  assert.equal(bot.army().length, 4);
  const gathered = w.resources[1] + spent + trained.reduce((s, u) => s + UNITS[u].cost, 0) - 250;
  assert.ok(gathered > 1000, `the economy produced ${gathered} Lumen`);

  // Verification-only test targets past the eastern chokepoint: two armed
  // test units plus three inert targets. The bot's army attack-moves onto them.
  const spawn = (unit, tx, ty) => w.issue({ type: 'devSpawn', unit, x: tx * 32 + 16, y: ty * 32 + 16, team: 2 }).id;
  const foes = [spawn('striker', 40, 20), spawn('sparker', 42, 22), spawn('dummy', 41, 18), spawn('dummy', 43, 20), spawn('dummy', 44, 23)];
  const army = bot.army();
  w.issue({ type: 'attackMove', ids: army.map((u) => u.id), x: 44 * 32, y: 20 * 32 });
  const took = runUntil(w, () => foes.every((id) => !w.get(id)), 180);
  const survivors = army.filter((u) => w.get(u.id));
  console.log(`# fight: all ${foes.length} test targets destroyed in ${took.toFixed(1)}s; survivors: ${survivors.map((u) => `${u.type} ${Math.ceil(u.hp)}hp`).join(', ')}`);
  assert.ok(took < 180, 'every test target destroyed');
  assert.ok(survivors.length >= 2, 'the army won decisively');
});
