import React, { useEffect, useState } from 'react';
import {
  getActiveTrolleySessionForCode, createTrolleySession, getTrolleyConfig,
  updateTrolleySession, subscribeTrolleySession, subscribeTrolleyPlayers,
  cleanupTrolleySessionPlayers,
} from '../../utils/firestore.js';
import ClassSummary from '../game/ClassSummary.jsx';

/**
 * The teacher's live-session control: launch → lobby/shopping → close.
 * Mirrors the trading game's SessionController.jsx shape but drives
 * trolleySessions instead of sessions, and shows ClassSummary (not a
 * price ticker/leaderboard) once baskets start coming in.
 *
 * There's no 'ended'→archive step here — closing a session calls
 * cleanupTrolleySessionPlayers, which deletes the player docs outright.
 * Trolley has no permanent archive (see the spec's still-open question
 * on this); if that changes, this is the function to extend.
 */
export default function TrolleySessionController({ gameCode, trolleyConfigId, adminUid }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = none
  const [players, setPlayers] = useState([]);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubSession = null;
    (async () => {
      const existing = await getActiveTrolleySessionForCode(gameCode);
      if (existing) {
        unsubSession = subscribeTrolleySession(existing.id, setSession);
      } else {
        setSession(null);
      }
    })();
    return () => { if (unsubSession) unsubSession(); };
  }, [gameCode]);

  useEffect(() => {
    if (!session?.id) { setPlayers([]); return; }
    return subscribeTrolleyPlayers(session.id, setPlayers);
  }, [session?.id]);

  const handleLaunch = async () => {
    setError(''); setLaunching(true);
    try {
      const config = await getTrolleyConfig(trolleyConfigId);
      if (!config) throw new Error('No pricing configuration is linked to your game code yet — ask your admin to check the Game Codes tab.');
      const sessionId = await createTrolleySession(gameCode, config, adminUid);
      unsubscribeAndResubscribe(sessionId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  };

  const unsubscribeAndResubscribe = (sessionId) => {
    subscribeTrolleySession(sessionId, setSession);
  };

  const handleOpenForShopping = async () => {
    await updateTrolleySession(session.id, { status: 'shopping', startedAt: new Date() });
  };

  const handleClose = async () => {
    if (!confirm('Close this session? All submitted baskets will be cleared — there is no archive to recover them from.')) return;
    await updateTrolleySession(session.id, { status: 'ended', endedAt: new Date() });
    await cleanupTrolleySessionPlayers(session.id, gameCode);
    setSession(null);
  };

  if (session === undefined) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  // No session yet — show a launch screen.
  if (!session || session.status === 'ended') {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>No session running</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Launch one to let your class join with the game code.
          </p>
          {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-full" onClick={handleLaunch} disabled={launching}>
            {launching ? 'Launching…' : 'Launch Session'}
          </button>
        </div>
      </div>
    );
  }

  const joinedCount = players.length;
  const completedCount = players.filter(p => p.completedAt != null).length;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${session.status === 'shopping' ? 'badge-green' : 'badge-yellow'}`}>
                {session.status === 'shopping' ? 'Shopping open' : 'Lobby — waiting to start'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Code: <code style={{ fontWeight: 700 }}>{gameCode.replace(/^TENENT-/, '')}</code>
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
              <strong>{joinedCount}</strong> joined · <strong>{completedCount}</strong> submitted
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {session.status === 'lobby' && (
              <button className="btn btn-primary" onClick={handleOpenForShopping}>Start Shopping</button>
            )}
            <button className="btn btn-danger btn-outline" onClick={handleClose}>Close Session</button>
          </div>
        </div>
      </div>

      {joinedCount === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            Waiting for students to join with the game code.
          </div>
        </div>
      ) : (
        <ClassSummary sessionId={session.id} />
      )}
    </div>
  );
}
