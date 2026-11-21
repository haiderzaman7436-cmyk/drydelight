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
  ChevronLeft,
  ChevronRight,
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

export default function Sidebar({
  mobileOpen,
  onClose,
  onRequestLogout,
  collapsed = false,
  onToggleCollapse,
}) {
  const { settings } = useSettings();
  const { profile } = useAuth();

  const sidebarContent = (
    <div
      className={`flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Brand header */}
      <div className="h-13 px-3 flex items-center justify-between border-b border-slate-200 shrink-0">
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'mx-auto' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Store className="w-4.5 h-4.5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                {settings.businessName || 'Dry Delight'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">Dry Delight POS</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-0.5">
        {NAV_ITEMS.map(({ label, to, icon: Icon, end, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-xs font-medium transition-colors ${
                collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : highlight
                    ? 'text-blue-700 bg-blue-50/80 hover:bg-blue-100/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Profile & Logout */}
      <div className="p-2 border-t border-slate-200 shrink-0 space-y-1.5">
        {!collapsed ? (
          <>
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {profile?.name || profile?.email || 'Staff'}
              </p>
              <p className="text-[10px] text-slate-500 capitalize leading-tight">
                {profile?.role || 'staff'}
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestLogout}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold uppercase"
              title={`${profile?.name || 'Staff'} (${profile?.role || 'staff'})`}
            >
              {(profile?.name || profile?.email || 'S').charAt(0)}
            </div>
            <button
              type="button"
              onClick={onRequestLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
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
