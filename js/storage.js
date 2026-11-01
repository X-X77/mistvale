// Preferences only. MISTVALE's opening has no save slots or progress persistence.
const KEY = 'mistvale.preferences.v2';
export const defaults = { sound: false, reducedMotion: false, speed: 'normal' };
export function normalize(value) {
  return { sound: value?.sound === true, reducedMotion: value?.reducedMotion === true,
    speed: ['slow', 'normal', 'fast', 'instant'].includes(value?.speed) ? value.speed : 'normal' };
}
export function readSave(storage) {
  try { return normalize(JSON.parse((storage || globalThis.localStorage).getItem(KEY))); } catch { return { ...defaults }; }
}
export function writeSave(value) {
  try { globalThis.localStorage.setItem(KEY, JSON.stringify(normalize(value))); return true; } catch { return false; }
}
