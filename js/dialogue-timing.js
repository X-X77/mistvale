// Reading time starts after typing finishes, not when a line first appears.
export function readingTime(text, speaker, speed = 'normal') {
  const pace = { slow: 100, normal: 75, fast: 60, instant: 75 }[speed] || 75;
  return Math.min(11000, Math.max(3200, 1700 + text.length * pace + (speaker === '베르' ? 1100 : 0)));
}
