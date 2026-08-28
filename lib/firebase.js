import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const app = firebaseReady
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

function makeFirestore() {
  if (!app) return null;
  try {
    // Some networks (corporate proxies, some mobile carriers, sandboxed
    // environments) block Firestore's native streaming connection. Auto
    // long-polling detects that and falls back transparently.
    // persistentLocalCache backs reads/writes with IndexedDB, so the app
    // (installed as a PWA or not) still opens and works with no signal.
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = makeFirestore();
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
