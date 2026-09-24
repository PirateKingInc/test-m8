import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const toScreen = (page, x, y) => page.evaluate(([x, y]) => {
  const cam = window.__game.scene.cameras.main;
  return { x: x - cam.scrollX, y: y - cam.scrollY };
}, [x, y]);
const count = (page, pred) => page.evaluate((src) => [...window.__game.world.ofKind('unit')].filter(new Function('u', `return ${src}`)).length, pred);

test('dev panel spawns test targets; A + click attack-moves and destroys them', async ({ page }) => {
  const errors = await openGame(page);
  await page.mouse.move(640, 400);

  // Dev panel (backtick) -> Test target -> Shift+click twice on the map.
  await page.keyboard.press('Backquote');
  await expect(page.locator('#dev-panel')).toBeVisible();
  await page.locator('#dev-panel button[data-spawn="dummy"]').click();
  for (const [tx, ty] of [[20, 30], [20, 32]]) {
    const p = await toScreen(page, tx * 32, ty * 32);
    await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Shift');
  }
  await page.keyboard.press('Escape');
  expect(await count(page, "u.type === 'dummy' && u.team === 2")).toBe(2);

  // Test setup shortcut: a squad of strikers south of the base.
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__game.world.addUnit('striker', 1, 12 * 32, (33 + i) * 32); });
  const a = await toScreen(page, 11 * 32, 32.5 * 32), b = await toScreen(page, 13 * 32, 37 * 32);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.scene.ui.selection.ids.length)).toBe(4);

  await page.keyboard.press('KeyA');
  const dest = await toScreen(page, 26 * 32, 31 * 32);
  await page.mouse.click(dest.x, dest.y);
  expect(await count(page, "u.order.type === 'attackMove'")).toBe(4);
  await expect.poll(() => count(page, "u.type === 'dummy'"), { timeout: 45000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('right-clicking a test target orders an attack on it', async ({ page }) => {
  await openGame(page);
  const ids = await page.evaluate(() => {
    const w = window.__game.world;
    const s = w.addUnit('striker', 1, 14 * 32, 34 * 32);
    const d = w.issue({ type: 'devSpawn', unit: 'dummy', x: 18 * 32, y: 38 * 32, team: 2 });
    window.__game.scene.ui.selection.set([s.id]);
    return { s: s.id, d: d.id };
  });
  const p = await toScreen(page, 18 * 32, 38 * 32);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  expect(await page.evaluate((id) => window.__game.world.get(id).order, ids.s)).toMatchObject({ type: 'attack', target: ids.d });
});
