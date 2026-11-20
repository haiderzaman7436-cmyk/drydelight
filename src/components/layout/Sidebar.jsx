import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderTree,
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  CalendarRange,
  RotateCcw,
  BarChart3,
  Settings,
  LogOut,
  Store,
  X,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Categories', to: '/categories', icon: FolderTree },
  { label: 'Products', to: '/products', icon: Package },
  { label: 'Inventory', to: '/inventory', icon: Boxes },
  { label: 'New Sale / POS', to: '/pos', icon: ShoppingCart, highlight: true },
  { label: 'Sales History', to: '/sales', icon: Receipt },
  { label: 'Sales Summary', to: '/sales-summary', icon: CalendarRange },
  { label: 'Sales Returns', to: '/returns', icon: RotateCcw },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar({ mobileOpen, onClose, onRequestLogout }) {
  const { settings } = useSettings();
  const { profile } = useAuth();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      {/* Brand header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {settings.businessName || 'Dry Delight'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">Dry Delight POS &amp; Inventory</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, to, icon: Icon, end, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : highlight
                    ? 'text-blue-700 bg-blue-50/80 hover:bg-blue-100/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-slate-200 shrink-0 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {profile?.name || profile?.email || 'Staff'}
          </p>
          <p className="text-[11px] text-slate-500 capitalize">
            {profile?.role || 'staff'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-50 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
