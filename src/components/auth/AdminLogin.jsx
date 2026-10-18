import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';

/**
 * Superadmin sign-in — email/password via Firebase Auth. Not copied from
 * the trading game (its AdminLogin.jsx wasn't shared with this session);
 * built fresh against the confirmed useAuth contract. On success,
 * useAuth's onAuthStateChanged picks up the superadmin role automatically
 * and App.jsx renders AdminDashboard — this component only needs to
 * handle the form and surface errors.
 */
export default function AdminLogin({ onBack }) {
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginAdmin(email.trim(), password);
      // onAuthStateChanged in useAuth picks up the role; App.jsx re-renders.
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : (err.message || 'Sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="loading-page">
      <div className="card" style={{ width: 360 }}>
        <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Admin sign-in</h3></div>
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
            <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
