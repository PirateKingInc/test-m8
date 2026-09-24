// Headless check of the Web Audio layer with a fake AudioContext.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sfx } from '../src/game/audio.js';

function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), type: '' });
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: node, createOscillator: node, createBiquadFilter: node, createBufferSource: node,
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    resume() {},
  };
  return ctx;
}

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('nothing plays before the first user gesture unlocks audio', () => {
  const sfx = new Sfx({ createContext: fakeContext, storage: memoryStorage() });
  sfx.handle([{ type: 'trained', x: 0, y: 0 }]);
  assert.equal(sfx.played, 0);
  sfx.unlock();
  sfx.handle([{ type: 'trained', x: 0, y: 0 }]);
  assert.equal(sfx.played, 1);
});

test('a burst of 40 simultaneous attacks is rate-limited to one voice', () => {
  const sfx = new Sfx({ createContext: fakeContext, storage: memoryStorage() });
  sfx.unlock();
  const burst = Array.from({ length: 40 }, () => ({ type: 'attack', attack: 'blade', x: 0, y: 0 }));
  sfx.handle(burst);
  assert.equal(sfx.played, 1);
  sfx.ctx.currentTime = 1;
  sfx.handle(burst);
  assert.equal(sfx.played, 2);
});

test('total voices are capped', () => {
  const sfx = new Sfx({ createContext: fakeContext, storage: memoryStorage() });
  sfx.unlock();
  for (let i = 0; i < 100; i++) { sfx.ctx.currentTime += 1; sfx.handle([{ type: 'death', kind: 'unit', x: 0, y: 0 }]); }
  assert.ok(sfx.voices <= 14, `voices ${sfx.voices}`);
});

test('M-toggle mutes everything and persists', () => {
  const storage = memoryStorage();
  const sfx = new Sfx({ createContext: fakeContext, storage });
  sfx.unlock();
  assert.equal(sfx.toggleMute(), true);
  sfx.handle([{ type: 'built' }, { type: 'trained' }]);
  sfx.ui('select');
  assert.equal(sfx.played, 0);
  assert.equal(new Sfx({ createContext: fakeContext, storage }).muted, true, 'mute survives a reload');
});

test('far-away world sounds are silent, UI sounds are not positional', () => {
  const sfx = new Sfx({ createContext: fakeContext, storage: memoryStorage() });
  sfx.unlock();
  sfx.handle([{ type: 'attack', attack: 'bolt', x: 5000, y: 5000 }], 0, 0);
  assert.equal(sfx.played, 0);
  sfx.ui('command');
  assert.equal(sfx.played, 1);
});
