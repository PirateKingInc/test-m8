import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const selected = (page) => page.evaluate(() => window.__game.scene.ui.selection.ids.slice().sort((a, b) => a - b));
const droneIds = (page) => page.evaluate(() => [...window.__game.world.ofKind('unit')].filter((u) => u.type === 'drone').map((u) => u.id).sort((a, b) => a - b));
const select = (page, ids) => page.evaluate((ids) => window.__game.scene.ui.selection.set(ids), ids);

test('Shift+digit assigns a control group and digit recalls it (no browser-reserved Ctrl needed)', async ({ page }) => {
  const errors = await openGame(page);
  const ids = await droneIds(page);
  await select(page, ids.slice(0, 2));
  await page.keyboard.press('Shift+Digit2');
  // Phaser handles key events on its next game-loop tick, so wait for the
  // assignment to land before changing the selection (else, on a slow frame,
  // the group would be assigned from the already-cleared selection).
  await expect.poll(() => page.evaluate(() => (window.__game.scene.ui.groups.groups.get(2) || []).length)).toBe(2);
  await select(page, []);
  await page.keyboard.press('Digit2');
  await expect.poll(() => selected(page)).toEqual(ids.slice(0, 2));
  await expect(page.locator('#groups button[data-group="2"] span')).toHaveText('×2');
  expect(errors).toEqual([]);
});

test('HUD control-group bar: right-click or Shift-click assigns, click recalls', async ({ page }) => {
  await openGame(page);
  const ids = await droneIds(page);
  await select(page, ids.slice(1, 4));
  await page.locator('#groups button[data-group="5"]').click({ button: 'right' });
  await select(page, [ids[0]]);
  await page.locator('#groups button[data-group="6"]').click({ modifiers: ['Shift'] });
  await select(page, []);
  await page.locator('#groups button[data-group="5"]').click();
  expect(await selected(page)).toEqual(ids.slice(1, 4));
  await page.locator('#groups button[data-group="6"]').click();
  expect(await selected(page)).toEqual([ids[0]]);
  await expect(page.locator('#groups button[data-group="5"] span')).toHaveText('×3');
});

test('Ctrl+digit is still honoured and its browser default is prevented', async ({ page }) => {
  await openGame(page);
  const ids = await droneIds(page);
  await select(page, ids.slice(0, 1));
  const prevented = await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { code: 'Digit7', key: '7', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__game.scene.ui.groups.groups.get(7) || []).length)).toBe(1); // see above
  await select(page, []);
  await page.keyboard.press('Digit7');
  await expect.poll(() => selected(page)).toEqual(ids.slice(0, 1));
});

test('Fullscreen button requests fullscreen and keyboard lock without errors', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.__lockCalls = [];
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { lock: async (keys) => { window.__lockCalls.push(keys); } } });
  });
  await page.locator('#fullscreen').click();
  await expect.poll(() => page.evaluate(() => window.__lockCalls.length)).toBe(1);
  expect(await page.evaluate(() => window.__lockCalls[0])).toContain('Digit1');
  expect(errors).toEqual([]);
});
