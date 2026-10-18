/**
 * Firestore Service Layer — Trolley
 *
 * Shared with every Tenent game (reused as-is from the trading game):
 *   /admins/{uid}        — role: 'superadmin' | 'teacher', email, gameCode, createdAt
 *   /gameCodes/{code}    — schoolName, contactEmail, startDate, endDate,
 *                          maxUsers, maxPlays, playsUsed, activeUsers,
 *                          status, gameConfigId, teacherEmail, createdBy, createdAt
 * These are the cross-game licensing layer — a school's purchased code and
 * its date window / concurrent-user cap / total-plays cap apply the same
 * way regardless of which game it's used for.
 *
 * Trolley-specific (NOT shared with the trading game's `gameConfigs` /
 * `sessions` collections, so this game's data can never show up in the
 * trading game's admin views, which assume trading-shaped fields):
 *
 * /trolleyConfigs/{id}
 *   name, recipeName, quantityOptions: [2,4,8]
 *   outlets: [{ id, name, travelCost, travelMode }]
 *   items: [{ id, name, required, quantityLabel, hasType, types?,
 *              byType?: { [type]: { outletId: [{ brand, tier, packSize, price }] } },
 *              brands?: { outletId: [{ brand, tier, packSize, price }] } }]
 *   `price` is for the item's 2-person quantityLabel (e.g. "250g"); see
 *   engine/calc.js for how quantity scaling works and why it's provisional
 *   deliveryOptions: { standardFee, whooshFee, whooshMarkup }
 *   createdBy, updatedAt
 *
 * /trolleySessions/{sessionId}
 *   gameCode, trolleyConfigId, trolleyConfig (denormalised snapshot, same
 *   pattern as the trading game's sessions.gameConfig)
 *   status: 'lobby' | 'shopping' | 'ended' | 'summary'
 *   adminUid, createdAt, startedAt, endedAt
 *
 * /trolleySessions/{sessionId}/players/{playerId}
 *   referenceNumber   — e.g. "15", assigned at join, never a name/nickname
 *   outlet            — assigned at join, immediately, invisibly
 *   quantity          — 2 | 4 | 8
 *   fulfilment        — 'in-store' | 'standard-delivery' | 'whoosh'
 *   basket            — { [itemId]: { productType?, brand, packSize, included: true } }
 *   itemSubtotal, fulfilmentCost, grandTotal
 *   joinedAt, completedAt, gameCode
 */

import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, increment, onSnapshot,
  deleteDoc, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.js';

// ─── Game Codes (shared) ────────────────────────────────────────────────────

export async function createGameCode(codeData, uid) {
  const ref = doc(db, 'gameCodes', codeData.code);
  await setDoc(ref, {
    ...codeData,
    playsUsed: 0,
    activeUsers: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  return codeData.code;
}

export async function getGameCode(code) {
  const snap = await getDoc(doc(db, 'gameCodes', code));
  return snap.exists() ? snap.data() : null;
}

export async function getAllGameCodes(uid) {
  const q = query(collection(db, 'gameCodes'), where('createdBy', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function updateGameCode(code, updates) {
  await updateDoc(doc(db, 'gameCodes', code), updates);
}

export async function disableGameCode(code) {
  await updateDoc(doc(db, 'gameCodes', code), { status: 'disabled' });
}

// ─── Teachers (shared) ──────────────────────────────────────────────────────

export async function getTeachersForCode(gameCode) {
  const q = query(
    collection(db, 'admins'),
    where('role', '==', 'teacher'),
    where('gameCode', '==', gameCode)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function getAllTeachers(createdBy) {
  const q = query(
    collection(db, 'admins'),
    where('role', '==', 'teacher'),
    where('createdBy', '==', createdBy)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ─── Role checks (shared) ───────────────────────────────────────────────────

export async function isAdmin(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

export async function getAdminRole(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists() ? snap.data() : null;
}

// ─── Usage stats (shared) ───────────────────────────────────────────────────

export async function getUsageStats(uid) {
  const codes = await getAllGameCodes(uid);
  return codes.map(c => ({
    code: c.code, school: c.schoolName,
    maxPlays: c.maxPlays, playsUsed: c.playsUsed ?? 0,
    maxUsers: c.maxUsers, activeUsers: c.activeUsers ?? 0,
    status: c.status, startDate: c.startDate, endDate: c.endDate,
  }));
}

// ─── Trolley Configs ─────────────────────────────────────────────────────────

export async function saveTrolleyConfig(config, uid) {
  const ref = config.id
    ? doc(db, 'trolleyConfigs', config.id)
    : doc(collection(db, 'trolleyConfigs'));
  await setDoc(ref, { ...config, id: ref.id, updatedAt: serverTimestamp(), createdBy: uid }, { merge: true });
  return ref.id;
}

export async function getTrolleyConfigs(uid) {
  const q = query(collection(db, 'trolleyConfigs'), where('createdBy', '==', uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getTrolleyConfig(id) {
  const snap = await getDoc(doc(db, 'trolleyConfigs', id));
  return snap.exists() ? snap.data() : null;
}

export async function deleteTrolleyConfig(id) {
  await deleteDoc(doc(db, 'trolleyConfigs', id));
}

// ─── Trolley Sessions ─────────────────────────────────────────────────────────

export async function createTrolleySession(gameCode, trolleyConfig, adminUid) {
  const ref = doc(collection(db, 'trolleySessions'));
  await setDoc(ref, {
    id: ref.id, gameCode,
    trolleyConfigId: trolleyConfig.id, trolleyConfig,
    status: 'lobby',
    nextReferenceNumber: 1, // atomic counter, see joinTrolleySession
    startedAt: null, endedAt: null,
    adminUid, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTrolleySession(sessionId) {
  const snap = await getDoc(doc(db, 'trolleySessions', sessionId));
  return snap.exists() ? snap.data() : null;
}

export async function updateTrolleySession(sessionId, updates) {
  await updateDoc(doc(db, 'trolleySessions', sessionId), updates);
}

export function subscribeTrolleySession(sessionId, callback) {
  return onSnapshot(doc(db, 'trolleySessions', sessionId), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

/**
 * Find the session a student should join for a given game code — the
 * most recent one that isn't 'ended'. Students can only join once a
 * teacher or admin has launched a session (see Access Model in the spec);
 * if none is found, the join screen tells them to wait for their teacher.
 *
 * NOTE: this `where(...).where(..., 'in', [...]).orderBy(...)` shape
 * needs a Firestore composite index — the console/CLI will prompt for it
 * (or error with a direct link to create it) the first time this runs
 * against a real project.
 */
export async function getActiveTrolleySessionForCode(gameCode) {
  const q = query(
    collection(db, 'trolleySessions'),
    where('gameCode', '==', gameCode),
    where('status', 'in', ['lobby', 'shopping']),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

// ─── Players ──────────────────────────────────────────────────────────────

/**
 * Join a Trolley session: enforces the game code's capacity (same
 * transaction pattern as the trading game's joinSession), then assigns an
 * outlet at random and a reference number — immediately, invisibly, with
 * no nickname ever requested or stored.
 *
 * Reference numbers come from an atomic counter on the session document
 * (not a count of existing player docs, which would race under concurrent
 * joins) — simple and good enough for the "Basket 15" display; swap for a
 * random draw here if a less orderly numbering is preferred later.
 */
export async function joinTrolleySession(sessionId, playerId, gameCode, outlets) {
  const codeRef    = doc(db, 'gameCodes', gameCode);
  const sessionRef = doc(db, 'trolleySessions', sessionId);
  const playerRef  = doc(db, 'trolleySessions', sessionId, 'players', playerId);

  return runTransaction(db, async (tx) => {
    // All reads before any writes, per Firestore transaction rules.
    const [codeSnap, sessionSnap] = await Promise.all([tx.get(codeRef), tx.get(sessionRef)]);
    if (!codeSnap.exists()) throw new Error('Game code not found');
    if (!sessionSnap.exists()) throw new Error('Session not found');
    const codeData = codeSnap.data();
    if ((codeData.activeUsers ?? 0) >= codeData.maxUsers) throw new Error('Session is full');

    const referenceNumber = String(sessionSnap.data().nextReferenceNumber ?? 1).padStart(2, '0');
    const outlet = outlets[Math.floor(Math.random() * outlets.length)];

    tx.update(codeRef, { activeUsers: increment(1) });
    tx.update(sessionRef, { nextReferenceNumber: increment(1) });
    tx.set(playerRef, {
      id: playerId,
      referenceNumber,
      outlet: outlet.id,
      quantity: null,
      fulfilment: null,
      basket: {},
      itemSubtotal: null, fulfilmentCost: null, grandTotal: null,
      joinedAt: serverTimestamp(), completedAt: null, gameCode,
    });

    return { referenceNumber, outlet };
  });
}

export async function updatePlayerBasket(sessionId, playerId, updates) {
  await updateDoc(doc(db, 'trolleySessions', sessionId, 'players', playerId), updates);
}

/**
 * Submit a finished basket: writes the final totals and marks the player
 * complete, mirroring the trading game's markPlayerComplete accounting
 * (1 completed basket = 1 play against the licence).
 */
export async function submitTrolleyBasket(sessionId, playerId, gameCode, basketResult) {
  await runTransaction(db, async (tx) => {
    const codeRef   = doc(db, 'gameCodes', gameCode);
    const playerRef = doc(db, 'trolleySessions', sessionId, 'players', playerId);
    tx.update(codeRef, { playsUsed: increment(1), activeUsers: increment(-1) });
    tx.update(playerRef, {
      ...basketResult, // { quantity, fulfilment, basket, itemSubtotal, fulfilmentCost, grandTotal }
      completedAt: serverTimestamp(),
    });
  });
}

export async function getPlayer(sessionId, playerId) {
  const snap = await getDoc(doc(db, 'trolleySessions', sessionId, 'players', playerId));
  return snap.exists() ? snap.data() : null;
}

export function subscribePlayer(sessionId, playerId, callback) {
  return onSnapshot(doc(db, 'trolleySessions', sessionId, 'players', playerId), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function subscribeTrolleyPlayers(sessionId, callback) {
  return onSnapshot(collection(db, 'trolleySessions', sessionId, 'players'), snap => {
    callback(snap.docs.map(d => d.data()));
  });
}

/**
 * Delete all player documents for a session and reset the game code's
 * activeUsers counter to 0 — called when the teacher closes the session,
 * same cleanup pattern as the trading game's cleanupSessionPlayers.
 * There is currently no permanent archive for Trolley (see Open Questions
 * in the spec — whether to add one is still undecided), so closing a
 * session discards its player data entirely; nothing survives beyond the
 * live Class Summary shown while the session was open.
 */
export async function cleanupTrolleySessionPlayers(sessionId, gameCode) {
  try {
    const snap  = await getDocs(collection(db, 'trolleySessions', sessionId, 'players'));
    const batch = writeBatch(db);
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
    }
    if (gameCode) {
      batch.update(doc(db, 'gameCodes', gameCode), { activeUsers: 0 });
    }
    await batch.commit();
  } catch (err) {
    console.warn('[cleanupTrolleySessionPlayers] Non-fatal:', err.message);
  }
}
