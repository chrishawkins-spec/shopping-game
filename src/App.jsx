import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import TrolleyAdminDashboard from './components/admin/TrolleyAdminDashboard.jsx';
import TrolleyTeacherDashboard from './components/admin/TrolleyTeacherDashboard.jsx';
import AdminLogin from './components/auth/AdminLogin.jsx';
import TeacherLogin from './components/auth/TeacherLogin.jsx';
import TrolleyJoin from './components/auth/TrolleyJoin.jsx';
import TrolleyGameScreen from './components/game/TrolleyGameScreen.jsx';
import './styles/global.css';

// Same screen-state-machine pattern as the trading game's App.jsx — no
// router library, just conditional rendering driven by auth + local state.
function AppInner() {
  const { user, roleLoading, isSuperadmin } = useAuth();

  // One of: 'home' | 'adminLogin' | 'teacherLogin'
  const [screen, setScreen] = useState('home');

  // Set after successful TeacherLogin: { email, gameCode, trolleyConfigId }
  const [teacherSession, setTeacherSession] = useState(null);

  // Set after successful TrolleyJoin:
  // { sessionId, gameCode, trolleyConfig, playerId, referenceNumber, outlet }
  const [gameSession, setGameSession] = useState(null);

  if (user === undefined || roleLoading) {
    return (
      <div className="loading-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--orange)', borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: 'white' }}>T</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--navy)' }}>TENENT</span>
        </div>
        <div className="spinner" />
      </div>
    );
  }

  // ── Superadmin ─────────────────────────────────────────────────────────
  if (user && !user.isAnonymous && isSuperadmin) {
    return <TrolleyAdminDashboard />;
  }

  // ── Admin login ─────────────────────────────────────────────────────────
  if (screen === 'adminLogin') {
    return <AdminLogin onBack={() => setScreen('home')} />;
  }

  // ── Teacher login ───────────────────────────────────────────────────────
  if (screen === 'teacherLogin') {
    return (
      <TeacherLogin
        onBack={() => setScreen('home')}
        onVerified={(session) => { setTeacherSession(session); setScreen('home'); }}
      />
    );
  }

  // ── Teacher dashboard ───────────────────────────────────────────────────
  if (teacherSession) {
    return (
      <TrolleyTeacherDashboard
        teacherEmail={teacherSession.email}
        gameCode={teacherSession.gameCode}
        trolleyConfigId={teacherSession.trolleyConfigId}
        onLogout={() => setTeacherSession(null)}
      />
    );
  }

  // ── Student in an active session ────────────────────────────────────────
  if (gameSession) {
    return (
      <TrolleyGameScreen
        sessionId={gameSession.sessionId}
        trolleyConfig={gameSession.trolleyConfig}
        outlet={gameSession.outlet.id}
        referenceNumber={gameSession.referenceNumber}
      />
    );
  }

  // ── Student join (home) ─────────────────────────────────────────────────
  return (
    <TrolleyJoin
      onJoined={setGameSession}
      onTeacherLogin={() => setScreen('teacherLogin')}
      onAdminLogin={() => setScreen('adminLogin')}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
