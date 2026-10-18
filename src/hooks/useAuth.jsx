// Reused as-is from the trading game: the superadmin/teacher/student role
// model is a cross-game part of the Tenent platform, not specific to any
// one game, so there's no reason to rebuild it for Trolley.
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword, signInAnonymously,
  signOut, onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase.js';
import { getAdminRole } from '../utils/firestore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(undefined); // undefined = firebase not ready yet
  const [roleData, setRoleData]     = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        setRoleLoading(true);
        try {
          const data = await getAdminRole(u.uid);
          setRoleData(data); // { role, email, gameCode, ... } or null
        } catch (e) {
          setRoleData(null);
        } finally {
          setRoleLoading(false);
        }
      } else {
        setRoleData(null);
        setRoleLoading(false);
      }
    });
    return unsub;
  }, []);

  const isSuperadmin = roleData?.role === 'superadmin';
  const isTeacher    = roleData?.role === 'teacher';
  const isStaff      = isSuperadmin || isTeacher;

  const loginStaff   = (email, password) => signInWithEmailAndPassword(auth, email, password);
  // Students never pick a name or nickname — joining is purely anonymous,
  // gated by the game code and an open session (see Access Model in the spec).
  const loginStudent = () => signInAnonymously(auth);
  const logout       = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user, roleData, roleLoading,
      isSuperadmin, isTeacher, isStaff,
      adminRole: roleData?.role ?? null,
      loginAdmin: loginStaff,
      loginAnonymous: loginStudent,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
