// 시드 가능한 난수(mulberry32). 테스트와 난이도 시뮬레이션에서 같은 결과를 재현하기 위해 씁니다.
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.range = (min, max) => min + (max - min) * next();
  next.int = (min, max) => Math.floor(min + (max - min + 1) * next());
  next.pick = list => list[Math.floor(next() * list.length)];
  next.chance = p => next() < p;
  return next;
}
