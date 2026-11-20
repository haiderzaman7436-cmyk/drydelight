import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain &&
    firebaseConfig.appId &&
    !String(firebaseConfig.apiKey).startsWith('your_')
);

const app = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : {
        apiKey: 'demo-unconfigured',
        authDomain: 'demo-unconfigured.firebaseapp.com',
        projectId: 'demo-unconfigured',
        appId: '1:000000000000:web:0000000000000000000000',
      }
);

export const auth = getAuth(app);

// Enable IndexedDB persistent multi-tab local cache for fast reads & snappy navigation
let firestoreInstance;
if (typeof window !== 'undefined') {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }
} else {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export let analytics = null;

if (typeof window !== 'undefined' && isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  if (firebaseConfig.measurementId) {
    isAnalyticsSupported()
      .then((supported) => {
        if (supported) analytics = getAnalytics(app);
      })
      .catch(() => {});
  }
}

export default app;
