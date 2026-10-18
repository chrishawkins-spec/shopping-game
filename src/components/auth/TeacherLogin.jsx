import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getGameCode } from '../../utils/firestore.js';

/**
 * Teacher sign-in — email/password via Firebase Auth, same mechanism as
 * AdminLogin. This assumes teachers get a real Firebase Auth account (the
 * trading game's TeacherManager admin screen walks a superadmin through
 * creating one via the Firebase Console) rather than a password-free
 * code+email check — TeacherLogin.jsx itself wasn't shared with this
 * session, and App.jsx's one comment about it ("already signed in
 * anonymously") hints at a different mechanism I can't safely guess at
 * for a login screen. If the real trading-game flow turns out to be
 * different, this is the one component to reconcile — share the original
 * TeacherLogin.jsx and I'll match it exactly.
 */
export default function TeacherLogin({ onBack, onVerified }) {
  const { loginAdmin, roleData, roleLoading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginAdmin(email.trim(), password);
      setResolving(true); // wait for roleData to resolve below
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : (err.message || 'Sign-in failed.'));
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!resolving || roleLoading || !user) return;
    (async () => {
      if (roleData?.role !== 'teacher') {
        setError('This account is not set up as a teacher. Contact your Tenent administrator.');
        setResolving(false);
        setSubmitting(false);
        return;
      }
      try {
        const codeDoc = await getGameCode(roleData.gameCode);
        if (!codeDoc) throw new Error(`Game code "${roleData.gameCode}" not found.`);
        onVerified({
          email: roleData.email,
          gameCode: roleData.gameCode,
          // gameCodes.gameConfigId is the shared field name across every
          // Tenent game; for a Trolley code it points at a trolleyConfigs doc.
          trolleyConfigId: codeDoc.gameConfigId,
        });
      } catch (err) {
        setError(err.message || 'Could not load your assigned game code.');
        setResolving(false);
        setSubmitting(false);
      }
    })();
  }, [resolving, roleLoading, roleData, user, onVerified]);

  return (
    <div className="loading-page">
      <div className="card" style={{ width: 360 }}>
        <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Teacher sign-in</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required autoFocus value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {onBack && (
            <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={onBack} disabled={submitting}>
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
