import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner label="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16 bg-white border border-slate-200 rounded-xl text-center">
        <h2 className="text-lg font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600 mt-2">
          Your role ({role || 'unknown'}) does not have permission to view this section.
        </p>
      </div>
    );
  }

  return children;
}
