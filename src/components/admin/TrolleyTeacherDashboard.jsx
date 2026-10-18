import React from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import TrolleySessionController from './TrolleySessionController.jsx';

/**
 * Teacher's landing screen after TeacherLogin verifies their role.
 * Thin wrapper: header + sign-out, then hands off to
 * TrolleySessionController for the actual launch/monitor/close flow.
 */
export default function TrolleyTeacherDashboard({ teacherEmail, gameCode, trolleyConfigId, onLogout }) {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--navy)', color: 'white', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--orange)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }}>T</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Shopping Trolley — Teacher</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{teacherEmail}</div>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} onClick={handleLogout}>Sign out</button>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        <TrolleySessionController
          gameCode={gameCode}
          trolleyConfigId={trolleyConfigId}
          adminUid={user?.uid}
        />
      </div>
    </div>
  );
}
