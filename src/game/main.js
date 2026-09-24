import { World } from '../sim/world.js';
import { GameScene } from './scene.js';
import { Hud } from './hud.js';

const Phaser = globalThis.Phaser;
const params = new URLSearchParams(location.search);
const world = new World({ seed: Number(params.get('seed')) || 1337, PF: globalThis.PF });
const hud = new Hud();
const scene = new GameScene(world, hud);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f17',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene,
  banner: false,
});

// Handle for e2e tests and debugging.
window.__game = { world, scene, game };
