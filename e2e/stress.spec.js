import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test('40 units moving at once: the game keeps rendering and the sim keeps up', async ({ page }) => {
  const errors = await openGame(page);
  const result = await page.evaluate(async () => {
    const { world, game } = window.__game;
    const types = ['striker', 'sparker', 'bulwark', 'lancer', 'drone'];
    const ids = [];
    for (let i = 0; i < 40; i++) ids.push(world.addUnit(types[i % 5], 1, (4 + (i % 8)) * 32 + 16, (36 + Math.floor(i / 8)) * 32 + 16).id);
    world.issue({ type: 'move', ids, x: 26 * 32, y: 44 * 32 });
    const f0 = game.loop.frame, t0 = performance.now(), s0 = world.tick;
    await new Promise((r) => setTimeout(r, 4000));
    const secs = (performance.now() - t0) / 1000;
    // JS cost of one full redraw with 40 units (what our code controls).
    const r0 = performance.now();
    for (let i = 0; i < 30; i++) window.__game.scene.render(0.5);
    return { fps: (game.loop.frame - f0) / secs, simRate: (world.tick - s0) / secs, renderMs: (performance.now() - r0) / 30 };
  });
  console.log(`40-unit browser run: ${result.fps.toFixed(1)} fps (headless software GL), sim ${result.simRate.toFixed(1)} steps/s, render ${result.renderMs.toFixed(2)} ms/frame`);
  expect(result.renderMs).toBeLessThan(8); // leaves most of a 16.7 ms frame for the GPU
  // Raw fps is reported, not asserted: headless CI rasterizes in software and its
  // fps swings with machine load. What our code controls is asserted above/below.
  expect(result.simRate).toBeGreaterThan(17); // fixed timestep keeps pace with wall time
  expect(errors).toEqual([]);
});
