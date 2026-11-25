import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { verifyProfitPin } from '../utils/profitLock';

const ProfitLockContext = createContext(null);

export function ProfitLockProvider({ children }) {
  const { settings } = useSettings();
  const { isAuthenticated } = useAuth();

  const [unlocked, setUnlocked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const lockEnabled = settings.profitLockEnabled !== false;
  const isLocked = Boolean(lockEnabled && !unlocked);

  // Reset unlock state on logout or PIN change so sensitive figures stay protected
  useEffect(() => {
    if (!isAuthenticated) {
      setUnlocked(false);
      setModalOpen(false);
      setPinInput('');
      setError('');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setUnlocked(false);
  }, [settings.profitLockPinHash]);

  useEffect(() => {
    if (modalOpen) {
      const id = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [modalOpen]);

  const openUnlockModal = useCallback(() => {
    if (!lockEnabled) return;
    setPinInput('');
    setShowPin(false);
    setError('');
    setModalOpen(true);
  }, [lockEnabled]);

  const closeUnlockModal = useCallback(() => {
    setModalOpen(false);
    setPinInput('');
    setError('');
    setShowPin(false);
  }, []);

  const lockNow = useCallback(() => {
    setUnlocked(false);
    toast.success('Profit figures locked');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setError('Please enter your Profit Lock PIN.');
      inputRef.current?.focus();
      return;
    }

    const ok = verifyProfitPin(pinInput, settings.profitLockPinHash);
    if (!ok) {
      setError('Incorrect PIN. Please try again.');
      setPinInput('');
      inputRef.current?.focus();
      return;
    }

    setUnlocked(true);
    setModalOpen(false);
    setPinInput('');
    setError('');
    toast.success('Profit figures unlocked');
  };

  const value = useMemo(
    () => ({
      lockEnabled,
      isLocked,
      isUnlocked: !isLocked,
      openUnlockModal,
      closeUnlockModal,
      lockNow,
    }),
    [lockEnabled, isLocked, openUnlockModal, closeUnlockModal, lockNow]
  );

  return (
    <ProfitLockContext.Provider value={value}>
      {children}

      <Modal
        isOpen={modalOpen}
        onClose={closeUnlockModal}
        title="Unlock Profit Figures"
        subtitle="Enter your Profit Lock PIN to view Today's Profit & Monthly Profit."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeUnlockModal}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="profit-unlock-form"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Unlock Profit
            </button>
          </>
        }
      >
        <form id="profit-unlock-form" onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Lock className="w-4.5 h-4.5" />
            </div>
            <p className="text-xs text-amber-900 leading-snug">
              Today&apos;s Profit and Monthly Profit figures are protected to keep store margins private.
            </p>
          </div>

          <div>
            <label
              htmlFor="profit-lock-pin-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Profit Lock PIN
            </label>
            <div className="relative">
              <input
                id="profit-lock-pin-input"
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="off"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter PIN..."
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm font-mono tracking-widest border rounded-lg focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                    : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600 bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs font-medium text-red-600 mt-1.5">{error}</p>}
          </div>
        </form>
      </Modal>
    </ProfitLockContext.Provider>
  );
}

export function useProfitLock() {
  const ctx = useContext(ProfitLockContext);
  if (!ctx) throw new Error('useProfitLock must be used inside ProfitLockProvider');
  return ctx;
}
