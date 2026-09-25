// Verification (f): a whole match against the AI, played with nothing but
// touch events at screen positions on an emulated phone. The bot may *read*
// the game state (as the AI's read-only view does) to decide what to do, but
// every action is a real tap, drag, press-and-hold or pinch, including
// panning the camera to wherever it needs to act. It never calls game code.
import { test, expect } from '@playwright/test';
import { PHONE, openTouchGame } from './touch-helpers.js';

test.use(PHONE);
test.setTimeout(16 * 60_000);

const SAFE = { l: 40, r: 690, t: 70, b: 240 }; // clear of the HUD, action bar and group slots (844x390)
const CENTER = { x: 365, y: 155 };

test('mobile playthrough: touch controls alone play a full match against the AI to its end', async ({ page }) => {
  const query = process.env.PLAY_QUERY || '?mode=match&difficulty=easy&seed=11&speed=2';
  const { errors, touch } = await openTouchGame(page, query);
  const state = () => page.evaluate(() => {
    const w = window.__game.world, cam = window.__game.scene.cameras.main;
    const pick = (e) => ({ id: e.id, type: e.type, team: e.team, x: e.x, y: e.y, built: e.built, order: e.order?.type, queue: e.queue?.length ?? 0, carry: e.carry });
    return {
      time: w.time, lumen: w.resources[1], result: w.result && { winner: w.result.winner, reason: w.result.reason, time: w.result.time },
      units: [...w.ofKind('unit')].map(pick), buildings: [...w.ofKind('building')].map(pick),
      nodes: [...w.ofKind('node')].map((n) => ({ id: n.id, x: n.x, y: n.y })),
      cam: { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom }, armed: window.__game.scene.ui.boxArmed ? 'box' : window.__game.scene.ui.armed,
      supply: (() => { let used = 0, cap = 0; for (const u of w.ofKind('unit')) if (u.team === 1) used += { drone: 1, striker: 1, sparker: 1, bulwark: 3, lancer: 2 }[u.type] || 0; for (const b of w.ofKind('building')) if (b.team === 1 && b.built) cap += b.type === 'core' ? 10 : b.type === 'depot' ? 8 : 0; return { used, cap: Math.min(60, cap) }; })(),
    };
  });
  const toScreen = (s, x, y) => ({ x: (x - s.cam.x) * s.cam.zoom, y: (y - s.cam.y) * s.cam.zoom });
  const actions = { taps: 0, drags: 0, holds: 0, pinches: 0 };
  const tap = async (x, y) => { actions.taps++; await touch.tap(x, y); };
  const drag = async (a, b, c, d) => { actions.drags++; await touch.drag(a, b, c, d); };

  // Pan with one-finger drags until world (x, y) is inside the safe area; returns its screen point.
  async function view(x, y) {
    for (let i = 0; i < 12; i++) {
      const s = await state(), p = toScreen(s, x, y);
      if (p.x > SAFE.l && p.x < SAFE.r && p.y > SAFE.t && p.y < SAFE.b) return p;
      const dx = Math.max(-300, Math.min(300, CENTER.x - p.x)), dy = Math.max(-80, Math.min(80, CENTER.y - p.y));
      await drag(CENTER.x - dx / 2, CENTER.y - dy / 2, CENTER.x + dx / 2, CENTER.y + dy / 2);
    }
    const s = await state();
    return toScreen(s, x, y);
  }
  const tapWorld = async (x, y) => { const p = await view(x, y); await tap(p.x, p.y); };
  async function arm(mode) {
    for (let i = 0; i < 3; i++) {
      await touch.tapEl(`[data-touch="${mode}"]`); actions.taps++;
      try { await expect.poll(async () => (await state()).armed, { timeout: 2000 }).toBe(mode); return true; } catch { /* retry */ }
    }
    return false;
  }
  async function selectUnit(u) { await tapWorld(u.x, u.y); }
  async function order(target) { if (await arm('order')) await tapWorld(target.x, target.y); }
  const enabled = (action) => page.evaluate((a) => { const b = document.querySelector(`#command-card button[data-action="${a}"]`); return !!b && !b.disabled; }, action);
  async function cardTap(action, times = 1) {
    for (let i = 0; i < times; i++) {
      if (!(await enabled(action))) return i;
      await touch.tapEl(`#command-card button[data-action="${action}"]`); actions.taps++;
      await page.waitForTimeout(80);
    }
    return times;
  }

  const mine = (s, kind, type) => s[kind].filter((e) => e.team === 1 && (!type || e.type === type));
  let s = await state();
  const core = mine(s, 'buildings', 'core')[0];
  const nearNode = (p) => s.nodes.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  const enemyCore = s.buildings.find((b) => b.team === 2 && b.type === 'core');
  const rally = { x: core.x + 230, y: core.y + 20 }; // just in front of the Core: idle units there defend it

  // Put idle Drones to work: double-tap one (selects every Drone on screen), Order, tap a crystal.
  async function regather() {
    s = await state();
    const idle = mine(s, 'units', 'drone').filter((d) => d.order === 'idle' && !d.carry);
    if (!idle.length) return;
    await selectUnit(idle[0]);
    const p = await view(idle[0].x, idle[0].y);
    await touch.doubleTap(p.x, p.y); actions.taps += 2;
    await order(nearNode(idle[0]));
  }

  async function build(type, spot) {
    s = await state();
    const drones = mine(s, 'units', 'drone');
    if (!drones.length) return false;
    // Drones move; tap until one is actually selected (a player would re-tap too).
    let got = false;
    for (let i = 0; i < 4 && !got; i++) {
      s = await state();
      const d = mine(s, 'units', 'drone').sort((a, b) => (a.order === 'gather' ? 0 : 1) - (b.order === 'gather' ? 0 : 1))[i % drones.length];
      await selectUnit(d);
      got = await page.evaluate(() => window.__game.scene.ui.selection.entities(window.__game.world).some((e) => e.team === 1 && e.type === 'drone'));
    }
    if (!got) return false;
    await page.waitForTimeout(150); // the command card refreshes every 100 ms
    if (!(await enabled(`build:${type}`))) return false;
    await touch.tapEl(`#command-card button[data-action="build:${type}"]`); actions.taps++;
    const before = mine(s, 'buildings', type).length;
    const p = await view(spot.x, spot.y);
    await drag(p.x - 20, p.y, p.x, p.y); // the ghost follows the finger; lifting places it
    s = await state();
    return mine(s, 'buildings', type).length > before;
  }

  const slotPoint = async (n) => { const b = await page.locator(`#groups button[data-group="${n}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  // Box-select the army around the rally point and save it as group 1 (press and hold).
  async function groupArmy() {
    await view(rally.x, rally.y);
    if (!(await arm('box'))) return;
    s = await state();
    const a = toScreen(s, rally.x - 320, rally.y - 280), b = toScreen(s, rally.x + 320, rally.y + 280);
    await drag(Math.max(SAFE.l, a.x), Math.max(SAFE.t - 30, a.y), Math.min(SAFE.r, b.x), Math.min(SAFE.b + 40, b.y));
    const p = await slotPoint(1);
    await touch.hold(p.x, p.y, 700); actions.holds++;
  }
  // Recall group 1 from the bar, arm Attack-move and tap the target.
  async function sendGroup(target) {
    const p = await slotPoint(1);
    await tap(p.x, p.y);
    if (await arm('attack')) await tapWorld(target.x, target.y);
  }

  // ---- the game plan -------------------------------------------------------
  // Pinch out a little so the whole base fits on the phone screen.
  await touch.pinch(CENTER.x, CENTER.y, 240, 120); actions.pinches++; // ~0.5x: base and rally point on one screen
  await regather();
  const plan = [
    { type: 'depot', spot: { x: core.x + 150, y: core.y - 120 } },
    { type: 'foundry', spot: { x: core.x + 150, y: core.y + 140 } },
    { type: 'depot', spot: { x: core.x - 20, y: core.y - 170 } },
    { type: 'spire', spot: { x: core.x + 300, y: core.y - 70 } },
    { type: 'foundry', spot: { x: core.x + 40, y: core.y + 220 } },
    { type: 'spire', spot: { x: core.x + 300, y: core.y + 110 } },
    { type: 'depot', spot: { x: core.x - 20, y: core.y + 170 } },
    { type: 'depot', spot: { x: core.x - 120, y: core.y - 60 } },
  ];
  let wave = 0, grouped = false, maxArmy = 0, defends = 0;
  const placed = new Set();
  const rallied = new Set();
  const log = [];
  const started = Date.now();
  for (let round = 0; round < 2000 && Date.now() - started < 14 * 60_000; round++) {
    s = await state();
    if (s.result) break;
    if (round % 5 === 0) console.log(`[${Math.round((Date.now() - started) / 1000)}s real] game ${Math.round(s.time)}s lumen ${s.lumen} supply ${s.supply.used}/${s.supply.cap} drones ${mine(s, 'units', 'drone').length} army ${mine(s, 'units').filter((u) => u.type !== 'drone').length} buildings ${mine(s, 'buildings').map((b) => b.type[0] + (b.built ? '' : '*')).join('')} waves ${wave}`);
    // Build the next planned structure once the previous one is finished and it is affordable.
    const pending = mine(s, 'buildings').some((b) => !b.built);
    const cost = { depot: 100, foundry: 150, spire: 120 };
    // A Depot comes first whenever supply is running out; otherwise follow the plan.
    const lowSupply = s.supply.cap < 60 && s.supply.cap - s.supply.used < 5;
    // Keep two Foundries and two Spires: rebuild whatever the enemy destroys.
    for (const [type, want, spots] of [['foundry', 2, [{ x: core.x + 150, y: core.y + 140 }, { x: core.x + 40, y: core.y + 220 }]], ['spire', 2, [{ x: core.x + 300, y: core.y - 70 }, { x: core.x + 300, y: core.y + 110 }]]]) {
      const have = mine(s, 'buildings', type).length + plan.filter((p) => p.type === type).length;
      if (s.time > 150 && have < want) plan.push({ type, spot: spots[have % spots.length] });
    }
    if (lowSupply && !plan.some((p) => p.type === 'depot')) { // more Depots, in a column behind the Core
      const n = mine(s, 'buildings', 'depot').length;
      plan.unshift({ type: 'depot', spot: { x: core.x - 150, y: core.y - 250 + (n % 6) * 100 } });
    }
    const next = (lowSupply && plan.find((p) => p.type === 'depot')) || plan.find((p) => p.type !== 'depot' || mine(s, 'buildings', 'depot').length === 0);
    if (next && !pending && s.lumen >= cost[next.type]) {
      const ok = await build(next.type, next.spot);
      if (ok) { log.push(`${Math.round(s.time)}s placed ${next.type}`); placed.add(next.type); plan.splice(plan.indexOf(next), 1); }
      else next.spot = { x: next.spot.x + 40, y: next.spot.y + 30 }; // blocked spot: try beside it next time
    }
    await regather();
    s = await state();
    // Drones: up to 10, from the Core.
    const coreB = mine(s, 'buildings', 'core')[0];
    if (coreB && mine(s, 'units', 'drone').length < 14 && coreB.queue === 0 && s.lumen >= 50) {
      await tapWorld(coreB.x, coreB.y);
      await cardTap('train:drone', 1);
    }
    // Army: every finished Foundry keeps training, rallying ahead of the base.
    for (const f of mine(s, 'buildings', 'foundry').filter((b) => b.built && b.queue < 3)) {
      await tapWorld(f.x, f.y);
      if (!rallied.has(f.id)) { await order(rally); rallied.add(f.id); }
      const pickUnit = ['striker', 'sparker', 'striker', 'lancer'][(round + f.id) % 4];
      await tapWorld(f.x, f.y);
      await cardTap(`train:${pickUnit}`, 3);
    }
    // Defense: enemy combat units near the base -> the whole army goes at them.
    s = await state();
    const threat = s.units.find((u) => u.team === 2 && u.type !== 'drone' && Math.hypot(u.x - core.x, u.y - core.y) < 700);
    const armyNow = mine(s, 'units').filter((u) => u.type !== 'drone');
    if (threat && armyNow.length) {
      await groupArmy();
      await sendGroup(threat);
      log.push(`${Math.round(s.time)}s defend`);
      defends++;
      continue;
    }
    // Attack: when 14+ combat units wait at the rally point, box-select them,
    // save them as group 1 (press and hold), then attack-move on the enemy Core.
    s = await state();
    const army = mine(s, 'units').filter((u) => u.type !== 'drone');
    maxArmy = Math.max(maxArmy, army.length);
    const atRally = army.filter((u) => Math.hypot(u.x - rally.x, u.y - rally.y) < 260);
    if (atRally.length >= 16 + wave * 2) {
      await groupArmy();
      grouped = true;
      await sendGroup(enemyCore);
      wave++;
      log.push(`${Math.round(s.time)}s wave ${wave}: ${atRally.length} units`);
    } else if (grouped && army.some((u) => u.order === 'idle' && Math.hypot(u.x - rally.x, u.y - rally.y) > 600)) {
      await sendGroup(enemyCore); // a wave that stopped short attacks again
    }
    await page.waitForTimeout(400);
  }
  s = await state();
  console.log(`mobile playthrough: ${log.join('; ')}`);
  console.log(`mobile playthrough result: ${s.result ? `${s.result.winner === 1 ? 'player (touch) wins' : s.result.winner === 2 ? 'AI wins' : 'draw'} by ${s.result.reason} at ${Math.round(s.result.time)}s game time` : `no result by ${Math.round(s.time)}s`}; max army ${maxArmy}, waves ${wave}, defences ${defends}; touch actions: ${JSON.stringify(actions)}`);
  // The claim is that touch alone can play a whole match to its end, not that
  // this simple scripted player beats the AI (it usually loses; see README).
  expect(s.result, 'the match reached a declared result').toBeTruthy();
  for (const type of ['depot', 'foundry', 'spire']) expect(placed.has(type), `placed a ${type} by touch`).toBe(true);
  expect(maxArmy, 'trained an army by touch').toBeGreaterThanOrEqual(10);
  expect(wave + defends, 'fought with armed touch orders (attack waves or defence)').toBeGreaterThanOrEqual(1);
  expect(actions.holds, 'assigned a control group by press-and-hold').toBeGreaterThanOrEqual(1);
  expect(actions.pinches, 'zoomed by pinch').toBeGreaterThanOrEqual(1);
  expect(actions.drags, 'panned and placed by dragging').toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
