import test from 'node:test';
import assert from 'node:assert/strict';
import { readingTime } from '../js/dialogue-timing.js';

test('long lines get more reading time after typing', () => {
  assert.ok(readingTime('가'.repeat(60), '낯선 아침') > readingTime('가'.repeat(12), '낯선 아침'));
});
test('엑스 (mascot) gets extra time, even with instant text', () => {
  assert.ok(readingTime('가'.repeat(40), '엑스', 'instant') > readingTime('가'.repeat(40), '낯선 아침', 'instant'));
  assert.ok(readingTime('짧은 말', '엑스', 'instant') >= 3200);
});
test('speed preferences affect dwell time with safe bounds', () => {
  assert.ok(readingTime('가'.repeat(60), '엑스', 'slow') > readingTime('가'.repeat(60), '엑스', 'fast'));
  assert.equal(readingTime('가'.repeat(500), '엑스'), 11000);
});
