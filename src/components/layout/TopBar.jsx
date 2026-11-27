import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingCart, Calendar, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/categories': 'Category Management',
  '/products': 'Product Management',
  '/inventory': 'Inventory Overview',
  '/pos': 'Point of Sale (POS)',
  '/sales': 'Sales History',
  '/sales-summary': 'Sales Summary',
  '/returns': 'Sales Returns',
  '/reports': 'Sales & Business Reports',
  '/settings': 'Store & Printer Settings',
};

export default function TopBar({
  onOpenMobileMenu,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
}) {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const title = PAGE_TITLES[pathname] || 'Dry Delight POS';

  return (
    <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-3 no-print select-none shadow-2xs">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-[#0f2347] hover:bg-blue-50"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            className="hidden lg:flex p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-[#0f2347] hover:bg-blue-50 transition-colors"
            title={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            aria-label="Toggle navigation sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4.5 h-4.5" />
            ) : (
              <PanelLeftClose className="w-4.5 h-4.5" />
            )}
          </button>
        )}

        <h1 className="text-base sm:text-lg font-bold text-[#0f2347] truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-[#f1f5fb] border border-slate-200/80 px-2.5 py-1 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>{formatDate(new Date())}</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-[#0f2347] bg-[#f1f5fb] border border-slate-200/80 px-2.5 py-1 rounded-lg capitalize">
          <User className="w-3.5 h-3.5 text-blue-600" />
          <span>{profile?.role || 'Staff'}</span>
        </div>

        {pathname !== '/pos' && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>New Sale</span>
          </Link>
        )}
      </div>
    </header>
  );
}
