import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const CDN = {
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js': 'node_modules/phaser/dist/phaser.min.js',
  'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js': 'node_modules/pathfinding/visual/lib/pathfinding-browser.min.js',
};

test('start screen: pick Hard + Turtle, start, and an AI opponent plays', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [url, file] of Object.entries(CDN)) await page.route(url, (r) => r.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }));
  await page.goto('/');
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('button[data-difficulty="hard"]').click();
  await expect(page.locator('#difficulty-note')).toContainText('Hard');
  await page.locator('#strategy').selectOption('turtle');
  await page.locator('#start-match').click();
  await page.waitForFunction(() => window.__game?.match && window.__game.world.tick > 20);
  expect(page.url()).toContain('difficulty=hard');
  expect(await page.evaluate(() => window.__game.match.ai.strategyId)).toBe('turtle');
  await expect(page.locator('#opponent')).toHaveText('vs AI · Hard');
  // The AI acts on its own through World.issue(): it queues Drones right away.
  await expect.poll(() => page.evaluate(() => window.__game.match.ai.stats.commands), { timeout: 15000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('sandbox from the menu has no opponent', async ({ page }) => {
  for (const [url, file] of Object.entries(CDN)) await page.route(url, (r) => r.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }));
  await page.goto('/');
  await page.locator('#start-sandbox').click();
  await page.waitForFunction(() => window.__game?.world.tick > 5);
  expect(await page.evaluate(() => window.__game.match)).toBe(null);
  expect(await page.evaluate(() => [...window.__game.world.ofKind('unit')].filter((u) => u.team === 2).length)).toBe(0);
});
