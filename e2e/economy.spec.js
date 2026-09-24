import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const toScreen = (page, x, y) => page.evaluate(([x, y]) => {
  const cam = window.__game.scene.cameras.main;
  return { x: x - cam.scrollX, y: y - cam.scrollY };
}, [x, y]);

test('right-clicking a crystal with drones starts the gather loop and Lumen rises', async ({ page }) => {
  const errors = await openGame(page);
  // Test setup shortcut: a finished Depot next to the home field.
  await page.evaluate(() => window.__game.world.addBuilding('depot', 1, 18, 27, { built: true }));
  const a = await toScreen(page, 12 * 32, 26 * 32), b = await toScreen(page, 15 * 32, 32 * 32);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  const node = await toScreen(page, 24 * 32, 28 * 32); // crystal at tile (23,27)
  await page.mouse.click(node.x, node.y, { button: 'right' });
  const orders = await page.evaluate(() => [...window.__game.world.ofKind('unit')].map((u) => u.order.type));
  expect(orders).toEqual(['gather', 'gather', 'gather', 'gather']);
  await expect.poll(() => page.locator('#lumen').textContent().then(Number), { timeout: 20000 }).toBeGreaterThan(250);
  expect(errors).toEqual([]);
});
