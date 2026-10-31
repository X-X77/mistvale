const KEY = 'mistvale.opening.v1';
export const defaults = { sound: false, reducedMotion: false, speed: 'normal', completed: false };
export function normalize(value) {
  return { sound: value?.sound === true, reducedMotion: value?.reducedMotion === true,
    speed: ['slow', 'normal', 'fast', 'instant'].includes(value?.speed) ? value.speed : 'normal',
    completed: value?.completed === true };
}
export function readSave(storage) {
  try { return normalize(JSON.parse((storage || globalThis.localStorage).getItem(KEY))); } catch { return { ...defaults }; }
}
export function writeSave(value) {
  try { localStorage.setItem(KEY, JSON.stringify(normalize(value))); return true; } catch { return false; }
}
