import { readFileSync } from 'node:fs';

// Serve the CDN libraries from node_modules so browser tests are hermetic.
const CDN = {
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js': 'node_modules/phaser/dist/phaser.min.js',
  'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js':
    'node_modules/pathfinding/visual/lib/pathfinding-browser.min.js',
};

export async function openGame(page, query = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [url, file] of Object.entries(CDN)) {
    await page.route(url, (route) => route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }));
  }
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__game?.scene?.gfx && window.__game.world.tick > 5);
  return errors;
}
