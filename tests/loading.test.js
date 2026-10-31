import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImages, createPixelLoader } from '../js/loading.js';

test('image readiness includes failure and progress reaches one', async () => {
  const original = globalThis.Image;
  globalThis.Image = class {
    set src(url) { queueMicrotask(() => url === 'missing' ? this.onerror?.() : this.onload?.()); }
    async decode() {}
  };
  try {
    const progress = [];
    const result = await prepareImages(['ok', 'missing'], { onProgress: value => progress.push(value) });
    assert.equal(result.filter(item => item.ok).length, 1);
    assert.equal(progress.at(-1), 1);
  } finally { globalThis.Image = original; }
});
test('abort settles readiness without late progress', async () => {
  const original = globalThis.Image;
  globalThis.Image = class { set src(_) {} };
  try {
    const controller = new AbortController();
    const progress = [];
    const pending = prepareImages(['pending'], { signal: controller.signal, onProgress: value => progress.push(value) });
    controller.abort();
    assert.equal((await pending)[0].ok, false);
    assert.equal(progress.length, 0);
  } finally { globalThis.Image = original; }
});
test('hung images time out, missing canvas is nonfatal', async () => {
  const original = globalThis.Image;
  globalThis.Image = class { set src(_) {} };
  try {
    assert.equal((await prepareImages(['hung'], { timeout: 10 }))[0].ok, false);
    const loader = createPixelLoader({ getContext: () => null });
    assert.doesNotThrow(() => { loader.start(); loader.stop(); });
  } finally { globalThis.Image = original; }
});
