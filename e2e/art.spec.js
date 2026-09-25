// Phase 4 art: every baked sprite is distinct from every other, by silhouette
// at low zoom (not just colour), and the two teams are told apart by colour.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

// Compare textures inside the page: an alpha silhouette sampled at the size a
// sprite is shown at 0.5x zoom (a 64 px unit box -> 32x32 screen px), plus the
// mean colour.
async function signatures(page, keys) {
  return page.evaluate((keys) => {
    const tm = window.__game.scene.textures, N = 32, out = {};
    for (const k of keys) {
      const src = tm.get(k).getSourceImage(), c = document.createElement('canvas');
      c.width = N; c.height = N;
      const ctx = c.getContext('2d');
      ctx.drawImage(src, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const mask = [];
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        mask.push(d[i + 3] > 96 ? 1 : 0);
        if (d[i + 3] > 96) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
      out[k] = { mask, color: [r / n, g / n, b / n], coverage: n / (N * N) };
    }
    return out;
  }, keys);
}

// 1 - intersection/union of the two silhouettes (0 = identical, 1 = no overlap).
const silhouetteDiff = (a, b) => {
  let inter = 0, union = 0;
  a.mask.forEach((v, i) => { inter += v & b.mask[i]; union += v | b.mask[i]; });
  return 1 - inter / union;
};
const colorDiff = (a, b) => Math.hypot(a.color[0] - b.color[0], a.color[1] - b.color[1], a.color[2] - b.color[2]);

test('every unit sprite has its own silhouette, and teams differ by colour', async ({ page }) => {
  const errors = await openGame(page);
  const types = ['drone', 'striker', 'sparker', 'bulwark', 'lancer'];
  const keys = [];
  for (const team of [1, 2]) for (const t of types) keys.push(`u-${t}-${team}`);
  const sig = await signatures(page, keys);
  for (const team of [1, 2]) {
    for (let i = 0; i < types.length; i++) for (let j = i + 1; j < types.length; j++) {
      const d = silhouetteDiff(sig[`u-${types[i]}-${team}`], sig[`u-${types[j]}-${team}`]);
      expect(d, `${types[i]} vs ${types[j]} silhouettes overlap too much at 0.5x`).toBeGreaterThan(0.35);
    }
  }
  for (const t of types) expect(colorDiff(sig[`u-${t}-1`], sig[`u-${t}-2`]), `${t}: team colours differ (mean colour; white parts dilute it)`).toBeGreaterThan(45);
  // Size ranks match the roster: the Drone is the smallest, the Bulwark the biggest body.
  expect(sig['u-drone-1'].coverage).toBeLessThan(sig['u-bulwark-1'].coverage);
  expect(errors).toEqual([]);
});
