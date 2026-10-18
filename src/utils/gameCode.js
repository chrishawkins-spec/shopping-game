/**
 * Game Code Utilities
 * Reused as-is from the trading game — game codes are the shared,
 * cross-game licensing mechanism (one `gameCodes` collection for every
 * Tenent game), so the format, validation, and licence-enforcement logic
 * is identical for Trolley.
 */

/** Generate a human-friendly game code like TENENT-XK7Q */
export function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TENENT-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Validate code format */
export function isValidGameCode(code) {
  return /^TENENT-[A-Z2-9]{4}$/.test(code?.toUpperCase());
}

/** Safely convert a Firestore Timestamp, JS Date, or seconds object to milliseconds */
function toMs(val) {
  if (!val) return null;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (val.seconds) return val.seconds * 1000;
  return null;
}

/** Check if a game code is currently active (within its date window) */
export function isGameCodeActive(gameCodeDoc) {
  if (!gameCodeDoc) return false;
  const now = Date.now();
  const start = toMs(gameCodeDoc.startDate) ?? 0;
  const end = toMs(gameCodeDoc.endDate) ?? Infinity;
  return now >= start && now <= end;
}

/** Check if the code has remaining plays */
export function hasRemainingPlays(gameCodeDoc) {
  if (!gameCodeDoc) return false;
  const used = gameCodeDoc.playsUsed ?? 0;
  const max = gameCodeDoc.maxPlays ?? 0;
  return used < max;
}

/** Check if the code has remaining user slots */
export function hasRemainingUsers(gameCodeDoc) {
  if (!gameCodeDoc) return false;
  const current = gameCodeDoc.activeUsers ?? 0;
  const max = gameCodeDoc.maxUsers ?? 0;
  return current < max;
}

/** Combined check: can this code be used by a new player right now? */
export function canJoinGame(gameCodeDoc) {
  const reasons = [];
  if (!gameCodeDoc) return { allowed: false, reason: 'Game code not found.' };
  if (!isGameCodeActive(gameCodeDoc)) {
    reasons.push('This game code has expired or is not yet active.');
  }
  if (!hasRemainingPlays(gameCodeDoc)) {
    reasons.push('This school has used all available plays. Please contact Tenent Financial Education.');
  }
  if (!hasRemainingUsers(gameCodeDoc)) {
    reasons.push('The maximum number of players for this session has been reached.');
  }
  if (gameCodeDoc.status === 'disabled') {
    reasons.push('This game code has been disabled.');
  }
  return reasons.length === 0
    ? { allowed: true }
    : { allowed: false, reason: reasons[0] };
}

/** Format date for display */
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  const ms = toMs(timestamp);
  if (ms) return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return '—';
}
