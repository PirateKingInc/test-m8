import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test('game boots, sim ticks, HUD shows the stockpile, no console errors', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#lumen')).toHaveText('250');
  const t0 = await page.evaluate(() => window.__game.world.time);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => window.__game.world.time);
  expect(t1).toBeGreaterThan(t0);
  expect(errors).toEqual([]);
});

test('camera pans with arrow keys and stays inside the map', async ({ page }) => {
  await openGame(page);
  const before = await page.evaluate(() => window.__game.scene.cameras.main.scrollX);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => window.__game.scene.cameras.main.scrollX);
  expect(after).toBeGreaterThan(before);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(() => window.__game.scene.cameras.main.scrollX)).toBe(0);
});
