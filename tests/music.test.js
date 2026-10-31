import test from 'node:test';
import assert from 'node:assert/strict';
import { Music } from '../js/music.js';

function audioMock() {
  return {
    paused: true,
    volume: 0,
    loop: false,
    preload: 'auto',
    src: '',
    playCalls: 0,
    play() { this.paused = false; this.playCalls++; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
}
test('no autoplay until the visitor activates BGM', async () => {
  const audio = audioMock();
  const bgm = new Music({ audio });
  bgm.setScene('title');
  assert.equal(audio.playCalls, 0);
  bgm.activate();
  await Promise.resolve();
  assert.equal(audio.src, './assets/audio/title-theme.mp3');
  assert.equal(audio.playCalls, 1);
  bgm.setScene('loading');
  assert.equal(audio.playCalls, 1);
  bgm.setEnabled(false);
  assert.equal(audio.paused, true);
  bgm.clearTimers();
});
test('story selects quiet farmhouse track, settings disable pauses', async () => {
  const audio = audioMock();
  const bgm = new Music({ audio });
  bgm.setScene('story');
  bgm.activate();
  await Promise.resolve();
  assert.equal(audio.src, './assets/audio/awakening-theme.mp3');
  bgm.setEnabled(false);
  assert.equal(audio.paused, true);
  bgm.clearTimers();
});