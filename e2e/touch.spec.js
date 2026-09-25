// Phase 4 touch controls, driven by real touch events in mobile emulation.
import { test, expect } from '@playwright/test';
import { PHONE, openTouchGame, screenOf, centerOn } from './touch-helpers.js';

test.use(PHONE);

const sel = (page) => page.evaluate(() => window.__game.scene.ui.selection.ids.slice().sort((a, b) => a - b));
const drones = (page) => page.evaluate(() => [...window.__game.world.ofKind('unit')].filter((u) => u.team === 1 && u.type === 'drone').map((u) => ({ id: u.id, x: u.x, y: u.y })));

test('touch mode shows the action bar; tap selects, tap on empty ground deselects', async ({ page }) => {
  const { errors, touch } = await openTouchGame(page);
  await expect(page.locator('#touchbar')).toBeVisible();
  expect(await page.evaluate(() => document.body.classList.contains('touch'))).toBe(true);
  const [d] = await drones(page);
  const s = await screenOf(page, d.x, d.y);
  await touch.tap(s.x + 8, s.y + 6); // a fingertip slightly off-center still picks it
  expect(await sel(page)).toEqual([d.id]);
  const empty = await screenOf(page, d.x, d.y - 110);
  await touch.tap(empty.x, empty.y);
  expect(await sel(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('double-tap a unit selects every own unit of that type on screen', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const ds = await drones(page);
  const s = await screenOf(page, ds[0].x, ds[0].y);
  await touch.tap(s.x, s.y);
  await touch.tap(s.x, s.y);
  expect(await sel(page)).toEqual(ds.map((d) => d.id).sort((a, b) => a - b));
});

test('▭ Box then drag box-selects; without Box a one-finger drag pans instead', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const ds = await drones(page);
  const xs = ds.map((d) => d.x), ys = ds.map((d) => d.y);
  const a = await screenOf(page, Math.min(...xs) - 30, Math.min(...ys) - 30), b = await screenOf(page, Math.max(...xs) + 30, Math.max(...ys) + 30);
  await touch.tapEl('#touchbar [data-touch="box"]');
  await expect(page.locator('#touchbar [data-touch="box"]')).toHaveClass(/armed/);
  await touch.drag(a.x, a.y, b.x, b.y);
  expect(await sel(page)).toEqual(ds.map((d) => d.id).sort((x, y) => x - y));
  await expect(page.locator('#touchbar [data-touch="box"]')).not.toHaveClass(/armed/);
  // Box is one-shot: the same drag now pans the camera and selects nothing new.
  await touch.tap(a.x, a.y - 60); // clear selection on empty ground
  const before = await page.evaluate(() => window.__game.scene.cameras.main.scrollX);
  await touch.drag(500, 200, 300, 200);
  const after = await page.evaluate(() => window.__game.scene.cameras.main.scrollX);
  expect(after - before).toBeGreaterThan(150);
  expect(await sel(page)).toEqual([]);
});

test('pinch zooms in and out within limits, keeping the pinch center steady; Base re-centers', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const zoom = () => page.evaluate(() => window.__game.scene.cameras.main.zoom);
  expect(await zoom()).toBe(1);
  const mid = await page.evaluate(() => { const c = window.__game.scene.cameras.main; return c.getWorldPoint(422, 195); });
  await touch.pinch(422, 195, 100, 200);
  const zIn = await zoom();
  expect(zIn).toBeGreaterThan(1.5);
  const midAfter = await page.evaluate(() => window.__game.scene.cameras.main.getWorldPoint(422, 195));
  expect(Math.hypot(midAfter.x - mid.x, midAfter.y - mid.y)).toBeLessThan(40);
  await touch.pinch(422, 195, 300, 40);
  expect(await zoom()).toBe(0.5);
  await touch.drag(200, 200, 600, 300);
  await touch.tapEl('#touchbar [data-touch="base"]');
  // At 0.5x the camera is clamped at the map edge, so check the Core is on screen.
  const onScreen = await page.evaluate(() => {
    const v = window.__game.scene.cameras.main.worldView;
    const core = [...window.__game.world.ofKind('building')].find((b) => b.team === 1 && b.type === 'core');
    return core.x > v.x && core.x < v.right && core.y > v.y && core.y < v.bottom;
  });
  expect(onScreen).toBe(true);
});

// ---- P4-2: orders from the action bar ---------------------------------------

const unit = (page, id) => page.evaluate((id) => { const u = window.__game.world.get(id); return u && { x: u.x, y: u.y, order: u.order.type, target: u.order.target, node: u.order.node }; }, id);

async function selectDrones(page, touch) {
  const ds = await drones(page);
  const s = await screenOf(page, ds[0].x, ds[0].y);
  await touch.tap(s.x, s.y); await touch.tap(s.x, s.y); // double-tap: all Drones
  return ds;
}

test('➜ Order is disabled with nothing selected, arms with a banner and rings, then moves on tap', async ({ page }) => {
  const { errors, touch } = await openTouchGame(page);
  await expect(page.locator('[data-touch="order"]')).toBeDisabled();
  const ds = await selectDrones(page, touch);
  await expect(page.locator('[data-touch="order"]')).toBeEnabled();
  await touch.tapEl('[data-touch="order"]');
  await expect(page.locator('[data-touch="order"]')).toHaveClass(/armed/);
  await expect(page.locator('#armed-banner')).toContainText('Tap a spot to move');
  expect(await page.evaluate(() => window.__game.scene.ui.armed)).toBe('order');
  const dest = await screenOf(page, ds[0].x, ds[0].y + 70);
  await touch.tap(dest.x, dest.y);
  await expect(page.locator('#armed-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__game.scene.ui.armed)).toBe(null);
  expect((await unit(page, ds[0].id)).order).toBe('move');
  expect(await sel(page)).toHaveLength(4); // the selection is kept
  // Tapping the armed button again disarms without an order.
  await touch.tapEl('[data-touch="order"]');
  await touch.tapEl('[data-touch="order"]');
  expect(await page.evaluate(() => window.__game.scene.ui.armed)).toBe(null);
  expect(errors).toEqual([]);
});

test('➜ Order on a crystal gathers; on an enemy attacks; ■ Stop stops', async ({ page }) => {
  const { touch } = await openTouchGame(page, '?mode=match&seed=4');
  const ds = await selectDrones(page, touch);
  const node = await page.evaluate(([x, y]) => { const ns = [...window.__game.world.ofKind('node')]; ns.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)); return { id: ns[0].id, x: ns[0].x, y: ns[0].y }; }, [ds[0].x, ds[0].y]);
  await centerOn(page, (node.x + ds[0].x) / 2, (node.y + ds[0].y) / 2);
  const ns = await screenOf(page, node.x, node.y);
  await touch.tapEl('[data-touch="order"]');
  await touch.tap(ns.x, ns.y);
  expect((await unit(page, ds[0].id)).order).toBe('gather');
  expect((await unit(page, ds[0].id)).node).toBe(node.id);
  await touch.tapEl('[data-touch="stop"]');
  expect((await unit(page, ds[0].id)).order).toBe('idle');
  // An enemy (a stationary test target) next to our Drones: Order + tap it = attack.
  const enemy = await page.evaluate(([x, y]) => window.__game.world.issue({ type: 'devSpawn', unit: 'dummy', team: 2, x: x + 90, y }).id, [ds[0].x, ds[0].y]);
  const e = await unit(page, enemy);
  await centerOn(page, e.x, e.y);
  const es = await screenOf(page, e.x, e.y);
  await touch.tapEl('[data-touch="order"]');
  await touch.tap(es.x + 6, es.y - 6);
  const d0 = await unit(page, ds[0].id);
  expect(d0.order).toBe('attack');
  expect(d0.target).toBe(enemy);
});

test('⚔ Attack-move arms and fires; ✕ Cancel disarms without an order', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const ids = await page.evaluate(() => { const w = window.__game.world; const c = [...w.ofKind('building')].find((b) => b.team === 1); return [0, 1, 2].map((i) => w.issue({ type: 'devSpawn', unit: 'striker', team: 1, x: c.x + 120, y: c.y - 40 + i * 30 }).id); });
  await page.evaluate((ids) => window.__game.scene.ui.selection.set(ids), ids);
  await touch.tapEl('[data-touch="attack"]');
  await expect(page.locator('#armed-banner')).toContainText('attack-move');
  await touch.tapEl('[data-touch="cancel"]');
  expect(await page.evaluate(() => window.__game.scene.ui.armed)).toBe(null);
  expect((await unit(page, ids[0])).order).not.toBe('attackMove');
  await touch.tapEl('[data-touch="attack"]');
  const u = await unit(page, ids[0]);
  const t = await screenOf(page, u.x + 150, u.y);
  await touch.tap(t.x, t.y);
  expect((await unit(page, ids[0])).order).toBe('attackMove');
});

test('Order with a Foundry selected sets its rally point', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const f = await page.evaluate(() => { const f = window.__game.world.addBuilding('foundry', 1, 14, 34, { built: true }); return { id: f.id, x: f.x, y: f.y }; });
  await centerOn(page, f.x + 50, f.y - 30);
  const fs = await screenOf(page, f.x, f.y);
  await touch.tap(fs.x, fs.y);
  expect(await sel(page)).toEqual([f.id]);
  await touch.tapEl('[data-touch="order"]');
  await expect(page.locator('#armed-banner')).toContainText('rally point');
  const r = await screenOf(page, f.x + 100, f.y - 60);
  await touch.tap(r.x, r.y);
  const rally = await page.evaluate((id) => window.__game.world.get(id).rally, f.id);
  expect(Math.hypot(rally.x - (f.x + 100), rally.y - (f.y - 60))).toBeLessThan(6);
});

test('touch placement: build button, drag the ghost, lift to place; ✕ cancels placement', async ({ page }) => {
  const { touch } = await openTouchGame(page);
  const ds = await selectDrones(page, touch);
  await touch.tapEl('#command-card button[data-action="build:depot"]');
  await expect(page.locator('#armed-banner')).toContainText('Lumen Depot');
  await touch.tapEl('[data-touch="cancel"]');
  expect(await page.evaluate(() => window.__game.scene.ui.placing)).toBe(null);
  await touch.tapEl('#command-card button[data-action="build:depot"]');
  const from = await screenOf(page, ds[0].x + 40, ds[0].y - 100), to = await screenOf(page, ds[0].x + 60, ds[0].y - 110);
  await touch.drag(from.x, from.y, to.x, to.y);
  const site = await page.evaluate(() => [...window.__game.world.ofKind('building')].find((b) => b.team === 1 && b.type === 'depot'));
  expect(site).toBeTruthy();
  expect(site.built).toBe(false);
  expect(Math.hypot(site.x - (ds[0].x + 60), site.y - (ds[0].y - 110))).toBeLessThan(40);
  expect(await page.evaluate(() => window.__game.scene.ui.placing)).toBe(null);
});
