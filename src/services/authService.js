import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { DEFAULT_SETTINGS } from './settingsService';

const INITIAL_ADMIN_UID = 'svYgtGefRsR2SQgBmqaWyBXFhYO2';

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact the administrator.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many failed login attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  'auth/configuration-not-found': 'Firebase Authentication is not configured for this project.',
};

export function mapAuthError(error) {
  if (!error) return 'Authentication failed.';
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return error.message || 'Authentication failed. Please try again.';
}

export async function fetchUserProfile(uid, firebaseUser = null) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  // One-time secure bootstrap for the pre-authorized initial admin account
  if (uid === INITIAL_ADMIN_UID && firebaseUser?.email) {
    const initialProfile = {
      name: firebaseUser.displayName || 'Store Administrator',
      email: firebaseUser.email,
      role: 'admin',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, initialProfile);

    // Initialize default store settings if missing
    const settingsRef = doc(db, 'settings', 'storeConfig');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    }

    return { id: uid, ...initialProfile };
  }

  return null;
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await fetchUserProfile(credential.user.uid, credential.user);

  if (!profile) {
    await signOut(auth);
    throw new Error(
      'Your account is not authorized to access this system. Ask an administrator to create your staff profile in Firestore (users collection).'
    );
  }

  if (profile.isActive === false) {
    await signOut(auth);
    throw new Error('Your account is currently deactivated. Please contact an administrator.');
  }

  return { user: credential.user, profile };
}

export async function logoutUser() {
  await signOut(auth);
}
