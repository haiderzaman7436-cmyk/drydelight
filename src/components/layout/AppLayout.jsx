import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { syncMissingProductImages } from '../../services/catalogImportService';
import { isValidProductImageUrl } from '../../utils/productImages';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dd_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout, isManagerOrAdmin } = useAuth();
  const { products, catalogLoaded, upsertProductLocal } = useData();
  const syncedImagesRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isManagerOrAdmin || !catalogLoaded || syncedImagesRef.current || products.length === 0) {
      return;
    }
    const hasMissing = products.some((p) => p?.id && !isValidProductImageUrl(p.imageUrl));
    if (!hasMissing) {
      syncedImagesRef.current = true;
      return;
    }

    syncedImagesRef.current = true;
    syncMissingProductImages(products)
      .then((patches) => {
        if (!patches?.length) return;
        const byId = new Map(products.map((p) => [p.id, p]));
        for (const patch of patches) {
          const orig = byId.get(patch.id);
          if (orig) upsertProductLocal({ ...orig, imageUrl: patch.imageUrl });
        }
      })
      .catch(() => {
        // Non-blocking: UI always falls back cleanly to getProductImage(product)
      });
  }, [isManagerOrAdmin, catalogLoaded, products, upsertProductLocal]);

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dd_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    <div className="min-h-screen bg-[#f1f5fb] antialiased text-slate-900">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onRequestLogout={() => {
          setMobileOpen(false);
          setLogoutModalOpen(true);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      <div
        className={`flex flex-col min-h-screen transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56'
        }`}
      >
        <TopBar
          onOpenMobileMenu={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
        />
        <main className="flex-1 p-3 sm:p-4 lg:p-4.5 max-w-[1536px] w-full mx-auto">
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
