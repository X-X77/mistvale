import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, readSave, normalize, writeSave } from '../js/storage.js';
test('missing and corrupt saves start safely with sound off', () => {
  for (const raw of [null, '{broken', 'null', '42']) {
    assert.deepEqual(readSave({ getItem: () => raw }), defaults);
  }
});
test('untrusted saved values are normalized', () => {
  assert.deepEqual(normalize({ sound: 'yes', reducedMotion: 1, speed: 'invalid', completed: 'true' }), defaults);
  assert.equal(normalize({ speed: 'instant', completed: true }).completed, true);
});
test('unavailable storage is nonfatal', () => {
  assert.deepEqual(readSave({ getItem() { throw new Error('blocked'); } }), defaults);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  assert.deepEqual(readSave(), defaults);
  assert.equal(writeSave(defaults), false);
  delete globalThis.localStorage;
});
test('preferences and completion survive a round trip', () => {
  let saved;
  globalThis.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const value = { sound: true, reducedMotion: true, speed: 'fast', completed: true };
  assert.equal(writeSave(value), true); assert.deepEqual(readSave(), value);
  delete globalThis.localStorage;
});
