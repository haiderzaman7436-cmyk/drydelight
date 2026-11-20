import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('Signed out successfully');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setLoggingOut(false);
      setLogoutModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onRequestLogout={() => {
          setMobileOpen(false);
          setLogoutModalOpen(true);
        }}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out"
        message="Are you sure you want to log out of Dry Delight Inventory & POS?"
        confirmLabel="Logout"
        loading={loggingOut}
      />
    </div>
  );
}
