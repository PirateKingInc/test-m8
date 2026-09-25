import { World } from '../sim/world.js';
import { Match } from '../ai/match.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { STRATEGIES } from '../data/strategies.js';
import { GameScene } from './scene.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Tutorial } from './tutorial.js';

const Phaser = globalThis.Phaser;
const params = new URLSearchParams(location.search);
const mode = params.get('mode');

// No mode chosen yet: show the start screen. Its choices become URL params, so
// "Play again" simply reloads the same setup.
if (mode !== 'match' && mode !== 'sandbox') {
  showMenu();
} else {
  start(mode);
}

function showMenu() {
  const menu = document.getElementById('menu');
  menu.hidden = false;
  let difficulty = 'normal';
  const buttons = menu.querySelectorAll('button[data-difficulty]');
  const describe = () => {
    const d = DIFFICULTY[difficulty];
    document.getElementById('difficulty-note').textContent =
      `${d.name}: plays ${STRATEGIES[d.strategy].name} by default. Decides every ${d.decisionInterval}s, reacts to scouting after ${d.reactionDelay}s.`;
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.difficulty === difficulty));
  };
  buttons.forEach((b) => b.addEventListener('click', () => { difficulty = b.dataset.difficulty; describe(); }));
  describe();
  const select = document.getElementById('strategy');
  const describeStrategy = () => {
    const id = select.value === 'auto' ? DIFFICULTY[difficulty].strategy : select.value;
    document.getElementById('strategy-note').textContent = `${STRATEGIES[id].name}: ${STRATEGIES[id].description}`;
  };
  select.addEventListener('change', describeStrategy);
  buttons.forEach((b) => b.addEventListener('click', describeStrategy));
  describeStrategy();
  document.getElementById('start-match').addEventListener('click', () => {
    const strategy = document.getElementById('strategy').value;
    location.search = `?mode=match&difficulty=${difficulty}&strategy=${strategy}`;
  });
  document.getElementById('start-sandbox').addEventListener('click', () => { location.search = '?mode=sandbox'; });
}

function start(mode) {
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e6);
  const difficulty = DIFFICULTY[params.get('difficulty')] ? params.get('difficulty') : 'normal';
  const strategy = STRATEGIES[params.get('strategy')] ? params.get('strategy') : 'auto';
  let match = null, world;
  if (mode === 'match') {
    match = new Match({ seed, PF: globalThis.PF, ai: { strategy, difficulty } });
    world = match.world;
  } else {
    world = new World({ seed, PF: globalThis.PF, setup: 'start' });
  }
  const hud = new Hud();
  const sfx = new Sfx();
  const scene = new GameScene(world, hud, sfx, match ? () => match.step() : () => world.step());
  hud.setOpponent(match ? { difficulty: DIFFICULTY[difficulty].name, strategy: STRATEGIES[match.ai.strategyId].name } : null);

  // Audio may only start after a user gesture.
  let greeted = false;
  for (const ev of ['pointerdown', 'keydown']) {
    addEventListener(ev, () => {
      sfx.unlock();
      if (match && !greeted) { greeted = true; sfx.ui('start'); } // the match-start horn, on the first gesture
    }, { capture: true });
  }
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

  const tutorial = startTutorial(sfx, !!match);
  setInterval(() => { if (scene.ui && !world.result) tutorial.update(world, scene.ui); }, 250);

  // Handle for e2e tests and debugging.
  window.__game = { world, scene, game, sfx, match, tutorial };
}

// The first-run hint panel (see tutorial.js); Help brings it back.
function startTutorial(sfx, isMatch) {
  const panel = document.getElementById('tutorial');
  const render = (v) => {
    panel.hidden = !v;
    if (!v) return;
    document.getElementById('tutorial-step').textContent = v.final ? 'done' : `${v.index} / ${v.total}`;
    document.getElementById('tutorial-text').innerHTML = v.text;
    document.getElementById('tutorial-skip').textContent = v.final ? 'Got it' : 'Skip';
  };
  const tutorial = new Tutorial({ render, onAdvance: () => sfx.ui('hint'), match: isMatch });
  document.getElementById('tutorial-skip').addEventListener('click', () => tutorial.finish());
  document.getElementById('help').addEventListener('click', () => {
    Tutorial.reset();
    Object.assign(tutorial, new Tutorial({ render, onAdvance: () => sfx.ui('hint'), match: isMatch }));
  });
  return tutorial;
}
