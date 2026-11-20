import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { DEFAULT_SETTINGS, getStoreSettings, saveStoreSettings } from '../services/settingsService';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);
const SETTINGS_STORAGE_KEY = 'pos_store_settings_cache_v1';

function readCachedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    if (!parsed.businessName || parsed.businessName === 'My Retail Store') {
      parsed.businessName = 'Dry Delight';
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeCachedSettings(data) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function SettingsProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [settings, setSettings] = useState(readCachedSettings);
  const [loading, setLoading] = useState(false);

  const refreshSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getStoreSettings();
      setSettings(data);
      writeCachedSettings(data);
    } catch (err) {
      console.error('Failed to load store settings:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    }
  }, [isAuthenticated, refreshSettings]);

  const updateSettings = useCallback(
    async (nextSettings) => {
      const saved = await saveStoreSettings(nextSettings, user?.uid);
      setSettings(saved);
      writeCachedSettings(saved);
      return saved;
    },
    [user?.uid]
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings,
      updateSettings,
    }),
    [settings, loading, refreshSettings, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
