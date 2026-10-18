// Same Tenent Firebase project as the other games (trading game etc.) —
// Trolley shares the `admins` and `gameCodes` collections (cross-game
// licensing), with its own `trolleyConfigs` / `trolleySessions` collections.
// No Realtime Database export here: Trolley has no shared clock to
// broadcast (see Technical Architecture in the spec) — Firestore's own
// live sync is enough, so `getDatabase` is intentionally not wired up.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
