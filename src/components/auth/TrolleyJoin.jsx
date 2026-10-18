import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getGameCode, getActiveTrolleySessionForCode, joinTrolleySession } from '../../utils/firestore.js';
import { isValidGameCode, canJoinGame } from '../../utils/gameCode.js';

/**
 * The student's entry screen — deliberately simpler than the trading
 * game's StudentJoin.jsx: a game code and nothing else. No nickname
 * field exists here at all (see the Access Model / Class Summary
 * sections of the spec — Trolley never collects a student name).
 *
 * On success, outlet and reference-number assignment have already
 * happened inside joinTrolleySession — this screen never sees or
 * influences that choice.
 */
export default function TrolleyJoin({ onJoined, onTeacherLogin, onAdminLogin }) {
  const { loginAnonymous } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalised = code.trim().toUpperCase();
    const fullCode = normalised.startsWith('TENENT-') ? normalised : `TENENT-${normalised}`;
    if (!isValidGameCode(fullCode)) {
      setError('That doesn’t look like a valid game code.');
      return;
    }

    setSubmitting(true);
    try {
      const codeDoc = await getGameCode(fullCode);
      const check = canJoinGame(codeDoc);
      if (!check.allowed) { setError(check.reason); return; }

      const session = await getActiveTrolleySessionForCode(fullCode);
      if (!session) { setError('Your teacher hasn’t started the session yet — ask them to launch it.'); return; }

      const cred = await loginAnonymous();
      const { referenceNumber, outlet } = await joinTrolleySession(
        session.id, cred.user.uid, fullCode, session.trolleyConfig.outlets
      );

      onJoined({
        sessionId: session.id,
        gameCode: fullCode,
        trolleyConfig: session.trolleyConfig,
        playerId: cred.user.uid,
        referenceNumber,
        outlet,
      });
    } catch (err) {
      setError(err.message || 'Something went wrong joining the game.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="loading-page">
      <div className="card" style={{ width: 360 }}>
        <div className="card-body">
          <h2 style={{ marginBottom: 4, textAlign: 'center' }}>Shopping Trolley Game</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginBottom: 20 }}>
            Enter the code your teacher gave you.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Game code</label>
              <input
                className="form-input"
                style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                required autoFocus value={code} placeholder="XK7Q"
                onChange={e => setCode(e.target.value)}
              />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={submitting}>
              {submitting ? 'Joining…' : 'Join'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20, fontSize: '0.8rem' }}>
            {onTeacherLogin && <a href="#" onClick={e => { e.preventDefault(); onTeacherLogin(); }}>Teacher login</a>}
            {onAdminLogin && <a href="#" onClick={e => { e.preventDefault(); onAdminLogin(); }}>Admin login</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
