// Per-tab visit state only. Closing a dialogue early never calls complete().
// sessionStorage survives reload/navigation, but is not a game save.
const KEY = 'mistvale.completedFirstMeetings.v1';
const completed = new Set();
try {
  const values = JSON.parse(sessionStorage.getItem(KEY) || '[]');
  if (Array.isArray(values)) for (const value of values) if (typeof value === 'string') completed.add(value);
} catch { /* Private/restricted storage: keep this document's in-memory state. */ }
export function hasMet(id) { return completed.has(id); }
export function completeFirstMeeting(id) {
  completed.add(id);
  try { sessionStorage.setItem(KEY, JSON.stringify([...completed])); } catch { /* Memory fallback. */ }
}
