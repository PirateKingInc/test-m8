// Phase 4 touch controls, driven by real touch events in mobile emulation.
import { test, expect } from '@playwright/test';
import { PHONE, openTouchGame, screenOf } from './touch-helpers.js';

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
