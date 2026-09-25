import { readFileSync } from 'node:fs';

// Serve the CDN libraries from node_modules so browser tests are hermetic.
const CDN = {
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js': 'node_modules/phaser/dist/phaser.min.js',
  'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js':
    'node_modules/pathfinding/visual/lib/pathfinding-browser.min.js',
};

export async function openGame(page, query = '?mode=sandbox', { tutorial = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [url, file] of Object.entries(CDN)) {
    await page.route(url, (route) => route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' }));
  }
  // Most tests play as a returning player, so the first-run tutorial stays out of the way.
  if (!tutorial) await page.addInitScript(() => { try { localStorage.setItem('prism-tutorial-v1', 'done'); } catch { /* ignore */ } });
  const crashed = new Promise((_, reject) => page.once('pageerror', reject));
  await page.goto(`/${query}`);
  // Fail fast with the real error instead of timing out if the page throws while booting.
  await Promise.race([page.waitForFunction(() => window.__game?.scene?.gfx && window.__game.world.tick > 5), crashed]);
  // Park the pointer mid-screen: Playwright's mouse starts at (0,0), inside the
  // edge-pan zone, which would scroll the camera between reading a position and clicking it.
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.evaluate(() => { const c = window.__game.scene.cameras.main; window.__game.scene.centerOnCore(); return c.scrollY; });
  return errors;
}
