import { useEffect, useState } from 'react';
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
  Clock,
  MapPin,
  Camera,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Categories', to: '/categories', icon: FolderTree },
  { label: 'Products', to: '/products', icon: Package },
  { label: 'Product Photos', to: '/product-photos', icon: Camera },
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
}) {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sidebarContent = (
    <div
      className={`flex flex-col h-full bg-[#0f2347] text-white border-r border-[#1b3563] transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand header */}
      <div className={`${collapsed ? 'px-2 py-3' : 'px-4 py-4'} flex items-center justify-between border-b border-white/10 shrink-0`}>
        <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'mx-auto' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-[#0f2347] flex items-center justify-center shrink-0 shadow-md">
            <Store className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate leading-tight">
                {settings.businessName || 'Dry Delight'}
              </p>
              <p className="text-[10px] text-blue-200/80 truncate">Retail Store</p>
              {settings.businessAddress && (
                <p className="text-[10px] text-amber-300 flex items-center gap-0.5 mt-0.5 truncate">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{settings.businessAddress}</span>
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
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
              `flex items-center rounded-lg text-xs font-medium transition-all ${
                collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : highlight
                    ? 'text-blue-100 bg-blue-500/20 border border-blue-400/25 hover:bg-blue-500/30'
                    : 'text-slate-200/90 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Profile, Logout & Live Clock */}
      <div className="p-2 border-t border-white/10 shrink-0 space-y-1.5">
        {!collapsed ? (
          <>
            <div className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.name || profile?.email || 'Staff'}
              </p>
              <p className="text-[10px] text-blue-200 capitalize leading-tight">
                {profile?.role || 'staff'}
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestLogout}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-red-500/25 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout</span>
            </button>
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0a1936] border border-white/10 text-center">
              <p className="text-[10px] text-blue-200/80 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                {formattedDate}
              </p>
              <p className="text-xs font-bold text-white tracking-wide mt-0.5">{formattedTime}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-7 h-7 rounded-full bg-blue-600 border border-white/20 text-white flex items-center justify-center text-[10px] font-bold uppercase"
              title={`${profile?.name || 'Staff'} (${profile?.role || 'staff'})`}
            >
              {(profile?.name || profile?.email || 'S').charAt(0)}
            </div>
            <button
              type="button"
              onClick={onRequestLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-200 hover:bg-red-500/25 hover:text-white transition-colors"
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
