import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { fetchUserProfile, loginWithEmail, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userProfile = await fetchUserProfile(firebaseUser.uid, firebaseUser);
        if (!userProfile || userProfile.isActive === false) {
          await logoutUser();
          setUser(null);
          setProfile(null);
          setAuthError(
            !userProfile
              ? 'Account is not authorized in the users collection.'
              : 'Your account has been deactivated.'
          );
        } else {
          setUser(firebaseUser);
          setProfile(userProfile);
          setAuthError('');
        }
      } catch (err) {
        console.error('Failed to verify user profile:', err);
        setUser(null);
        setProfile(null);
        setAuthError('Unable to verify user authorization. Check Firestore rules and connection.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthError('');
    const result = await loginWithEmail(email, password);
    setUser(result.user);
    setProfile(result.profile);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
  }, []);

  const role = profile?.role || '';
  const isAdmin = role === 'admin';
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isAdmin,
      isManagerOrAdmin,
      isAuthenticated: Boolean(user && profile),
      loading,
      authError,
      login,
      logout,
    }),
    [user, profile, role, isAdmin, isManagerOrAdmin, loading, authError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
