import { World } from '../sim/world.js';
import { GameScene } from './scene.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';

const Phaser = globalThis.Phaser;
const params = new URLSearchParams(location.search);
const setup = params.get('mode') === 'match' ? 'match' : 'start';
const world = new World({ seed: Number(params.get('seed')) || 1337, PF: globalThis.PF, setup });
const hud = new Hud();
const sfx = new Sfx();
const scene = new GameScene(world, hud, sfx);

// Audio may only start after a user gesture.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sfx.unlock(), { capture: true });
addEventListener('keydown', (e) => { if (e.code === 'KeyM') hud.setMuted(sfx.toggleMute()); });
hud.setMuted(sfx.muted);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f17',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene,
  banner: false,
});

// Handle for e2e tests and debugging.
window.__game = { world, scene, game, sfx };
