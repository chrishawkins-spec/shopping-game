import React, { useState, useEffect } from 'react';
import { createGameCode, getAllGameCodes, disableGameCode, updateGameCode, getTrolleyConfigs } from '../../utils/firestore.js';
import { formatDate } from '../../utils/gameCode.js';
import { useAuth } from '../../hooks/useAuth.jsx';

// Adapted from the trading game's GameCodeManager.jsx: this repo only
// manages Trolley codes, so the GAMES dropdown collapses to a fixed
// gameName rather than a game picker — "Shopping Challenge" is the
// platform's existing identifier for this game (confirmed against the
// trading game's own GameCodeManager, which already listed it as an
// unused placeholder).
const GAME_NAME = 'Shopping Challenge';

export default function TrolleyGameCodeManager() {
  const { user } = useAuth();
  const [codes, setCodes] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAll, setShowAll] = useState(false);

  const [form, setForm] = useState({
    schoolName: '', contactEmail: '', teacherEmail: '',
    gameConfigId: '', startDate: '', endDate: '',
    maxUsers: 35, maxPlays: 100,
  });

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, gc] = await Promise.all([getAllGameCodes(user.uid), getTrolleyConfigs(user.uid)]);
      setCodes(c);
      setConfigs(gc);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.gameConfigId) { setError('Please select a pricing configuration.'); return; }
    setSaving(true); setError('');
    try {
      // generateGameCode is intentionally not imported here — codes are
      // created with the shared gameCode.js helper, same as the trading game.
      const { generateGameCode } = await import('../../utils/gameCode.js');
      const code = generateGameCode();
      await createGameCode({
        code,
        gameName: GAME_NAME,
        schoolName: form.schoolName.trim(),
        contactEmail: form.contactEmail.trim(),
        teacherEmail: form.teacherEmail.trim().toLowerCase(),
        gameConfigId: form.gameConfigId,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate + 'T23:59:59'),
        maxUsers: Number(form.maxUsers),
        maxPlays: Number(form.maxPlays),
      }, user.uid);
      setSuccess(`Game code created: ${code}`);
      setShowCreate(false);
      setForm({ schoolName: '', contactEmail: '', teacherEmail: '', gameConfigId: '', startDate: '', endDate: '', maxUsers: 35, maxPlays: 100 });
      loadData();
    } catch (e) {
      setError('Failed to create code: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (code) => {
    if (!confirm(`Disable game code ${code}? Students will no longer be able to join.`)) return;
    await disableGameCode(code);
    loadData();
  };

  const handleReenable = async (code) => {
    await updateGameCode(code, { status: 'active' });
    loadData();
  };

  const today = new Date().toISOString().split('T')[0];

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Game Codes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Create codes for schools. Each code controls how many students can play and how many total plays are permitted.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Code</button>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ {success}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--orange)', borderWidth: 2 }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1rem' }}>Create New Game Code</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">School Name *</label>
                  <input className="form-input" required value={form.schoolName}
                    onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
                    placeholder="Oakwood Academy" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email *</label>
                  <input className="form-input" type="email" required value={form.contactEmail}
                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="admin@school.ac.uk" />
                </div>
                <div className="form-group">
                  <label className="form-label">Teacher Email</label>
                  <input className="form-input" type="email" value={form.teacherEmail}
                    onChange={e => setForm(f => ({ ...f, teacherEmail: e.target.value }))}
                    placeholder="teacher@school.ac.uk" />
                  <span className="form-hint">The teacher who will run this game — create their Firebase Auth + admins account separately (see Teachers tab)</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Pricing Configuration *</label>
                  <select className="form-select" required value={form.gameConfigId}
                    onChange={e => setForm(f => ({ ...f, gameConfigId: e.target.value }))}>
                    <option value="">— Select a config —</option>
                    {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {configs.length === 0 && (
                    <span className="form-hint" style={{ color: 'var(--red)' }}>
                      No pricing configs yet — run the import script (scripts/importPricingConfig.js) first.
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" required min={today} value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input className="form-input" type="date" required min={form.startDate || today} value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Concurrent Players</label>
                  <input className="form-input" type="number" min={1} max={200} value={form.maxUsers}
                    onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))} />
                  <span className="form-hint">How many students can be shopping at once</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Max Total Plays (Licence)</label>
                  <input className="form-input" type="number" min={1} value={form.maxPlays}
                    onChange={e => setForm(f => ({ ...f, maxPlays: e.target.value }))} />
                  <span className="form-hint">Each completed basket = 1 play</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Code'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>School</th><th>Teacher</th><th>Valid</th>
                <th>Plays Used</th><th>Users Now</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const now = Date.now();
                const visible = showAll
                  ? codes
                  : codes.filter(c => {
                      const start = c.startDate?.toMillis?.() ?? 0;
                      const end   = c.endDate?.toMillis?.() ?? Infinity;
                      return c.status === 'active' && now >= start && now <= end;
                    });
                const hiddenCount = codes.length - visible.length;

                if (codes.length === 0) return (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    No game codes yet. Create one above.
                  </td></tr>
                );
                if (visible.length === 0) return (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    No active codes right now.{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>Show all {codes.length}</button>
                  </td></tr>
                );

                return (
                  <>
                    {visible.map(c => {
                      const start = c.startDate?.toMillis?.() ?? 0;
                      const end   = c.endDate?.toMillis?.() ?? Infinity;
                      const isActive = now >= start && now <= end && c.status === 'active';
                      const playsLeft = c.maxPlays - (c.playsUsed ?? 0);
                      const playsExhausted = playsLeft <= 0;
                      return (
                        <tr key={c.code}>
                          <td><code style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>{c.code.replace(/^TENENT-/, '')}</code></td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{c.schoolName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.teacherEmail || <span style={{ fontStyle: 'italic' }}>Not set</span>}</td>
                          <td>{isActive ? <span className="badge badge-green">Active now</span> : <span className="badge badge-gray">Not active</span>}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.playsUsed ?? 0} / {c.maxPlays}</div>
                            <div style={{ fontSize: '0.78rem', color: playsExhausted ? 'var(--red)' : 'var(--green)' }}>
                              {playsExhausted ? '⚠ Exhausted' : `${playsLeft} remaining`}
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{c.activeUsers ?? 0} / {c.maxUsers}</td>
                          <td>{c.status === 'disabled' ? <span className="badge badge-red">Disabled</span> : <span className="badge badge-green">Active</span>}</td>
                          <td>
                            {c.status === 'active'
                              ? <button className="btn btn-sm btn-danger" onClick={() => handleDisable(c.code)}>Disable</button>
                              : <button className="btn btn-sm btn-success" onClick={() => handleReenable(c.code)}>Re-enable</button>}
                          </td>
                        </tr>
                      );
                    })}
                    {hiddenCount > 0 && !showAll && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>+ Show {hiddenCount} inactive/expired</button>
                      </td></tr>
                    )}
                    {showAll && codes.length > 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(false)}>Show active only</button>
                      </td></tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
