import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const coreOf = (team) => `[...window.__game.world.ofKind('building')].find((b) => b.team === ${team} && b.type === 'core')`;

test('match mode: destroying the enemy Command Core shows Victory', async ({ page }) => {
  const errors = await openGame(page, '?mode=match');
  expect(await page.evaluate(`!!${coreOf(2)}`)).toBe(true);
  await page.evaluate(`${coreOf(2)}.hp = 0`);
  await expect(page.locator('#result-title')).toHaveText('Victory');
  await expect(page.locator('#result-detail')).toContainText('enemy Command Core is destroyed');
  await expect(page.locator('#play-again')).toBeVisible();
  expect(errors).toEqual([]);
});

test('match mode: losing your own Command Core shows Defeat', async ({ page }) => {
  await openGame(page, '?mode=match');
  await page.evaluate(`${coreOf(1)}.hp = 0`);
  await expect(page.locator('#result-title')).toHaveText('Defeat');
});
