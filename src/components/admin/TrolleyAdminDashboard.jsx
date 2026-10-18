import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getAllGameCodes, getTrolleyConfigs, createTrolleySession } from '../../utils/firestore.js';

const GAME_NAME = 'Shopping Challenge';

/**
 * Superadmin screen for THIS repo only.
 *
 * Game codes, pricing configs and teacher accounts are now managed from
 * the master admin dashboard in the Trading Game Jr repo — that's the one
 * place that creates codes/configs/teachers across every Tenent game (see
 * CONFIG_SOURCE_BY_GAME in that repo's GameCodeManager.jsx). This repo's
 * earlier TrolleyAdminDashboard duplicated that (Game Codes / Configs /
 * Teachers tabs) — removed, since having two places to set up a school
 * for the same game was exactly the confusion to avoid.
 *
 * What's left here is just a quick way to launch/test a session without
 * needing a teacher account — a normal teacher still runs their class via
 * this app's own Teacher login (TeacherLogin.jsx -> TrolleySessionController),
 * which is unaffected by this change.
 */
export default function TrolleyAdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--navy)', color: 'white', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--orange)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }}>T</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Shopping Trolley — Superadmin</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} onClick={logout}>Sign out</button>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>
        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          Game codes, pricing configs and teacher accounts for Shopping Challenge are managed
          from the <strong>main Tenent admin</strong> (the Trading Game Jr app's superadmin
          dashboard) — not here. This screen is just a quick way to test-launch a session.
        </div>
        <LaunchTab uid={user?.uid} />
      </div>
    </div>
  );
}

// ── Launch tab ───────────────────────────────────────────────────────────
// Kept purely as a testing convenience — launches a session without
// needing a teacher account. Only shows Shopping Challenge codes, since
// gameCodes is a collection shared with every other Tenent game.
function LaunchTab({ uid }) {
  const [codes, setCodes] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [launched, setLaunched] = useState(null);

  useEffect(() => {
    if (!uid) return;
    Promise.all([getAllGameCodes(uid), getTrolleyConfigs(uid)]).then(([c, g]) => {
      setCodes(c.filter(x => x.status === 'active' && x.gameName === GAME_NAME));
      setConfigs(g);
    });
  }, [uid]);

  const handleLaunch = async () => {
    setError(''); setLaunched(null);
    const codeDoc = codes.find(c => c.code === selectedCode);
    if (!codeDoc) { setError('Select a game code.'); return; }
    const config = configs.find(cfg => cfg.id === codeDoc.gameConfigId);
    if (!config) { setError('This code has no matching pricing config — check it in the main Tenent admin.'); return; }

    setLaunching(true);
    try {
      const session = await createTrolleySession(codeDoc.code, config, uid);
      setLaunched(session);
    } catch (e) {
      setError('Failed to launch: ' + e.message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Launch a Session</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
        Opens a Shopping Challenge game code for students to join. Normally the teacher does
        this themselves from their own login — use this if you're testing.
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Game Code</label>
            <select className="form-select" value={selectedCode} onChange={e => setSelectedCode(e.target.value)}>
              <option value="">— Select —</option>
              {codes.map(c => <option key={c.code} value={c.code}>{c.code.replace(/^TENENT-/, '')} — {c.schoolName}</option>)}
            </select>
            {codes.length === 0 && (
              <span className="form-hint" style={{ color: 'var(--red)' }}>
                No active Shopping Challenge codes found — create one in the main Tenent admin.
              </span>
            )}
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
          {launched && (
            <div className="alert alert-success" style={{ marginBottom: 14 }}>
              ✓ Session launched. Students can now join with code <strong>{selectedCode.replace(/^TENENT-/, '')}</strong>.
            </div>
          )}
          <button className="btn btn-primary btn-full" disabled={!selectedCode || launching} onClick={handleLaunch}>
            {launching ? 'Launching…' : 'Launch Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
