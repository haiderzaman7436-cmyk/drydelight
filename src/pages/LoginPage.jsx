import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Store, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { mapAuthError } from '../services/authService';
import { isFirebaseConfigured } from '../firebase/config';

export default function LoginPage() {
  const { isAuthenticated, login, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    const redirectTo = location.state?.from?.pathname || '/';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFirebaseConfigured) {
      setError(
        'Firebase environment variables are not configured. Copy .env.example to .env and add your Firebase credentials.'
      );
      return;
    }

    if (!email.trim() || !password) {
      setError('Please enter both email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = mapAuthError(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2347] via-[#132b57] to-[#0b1933] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#0f2347] flex items-center justify-center mx-auto shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white mt-3">
            Dry Delight
          </h1>
          <p className="text-sm text-blue-200 mt-1">
            Inventory &amp; POS Management · Staff Sign In
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-white/10 shadow-xl p-6 sm:p-8">
          {!isFirebaseConfigured && (
            <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed flex gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Firebase not configured yet</p>
                <p className="mt-0.5">
                  Copy <code className="font-mono">.env.example</code> to{' '}
                  <code className="font-mono">.env</code> and add your Firebase project keys, then
                  restart the dev server.
                </p>
              </div>
            </div>
          )}

          {displayError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed flex gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@drydelight.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 mt-2"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            Authorized personnel only. Public registration is disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
