import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingCart, Calendar, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

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
  const title = PAGE_TITLES[pathname] || 'Dry Delight POS';

  return (
    <header className="sticky top-0 z-20 h-13 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-3 no-print select-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            className="hidden lg:flex p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
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

        <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-md">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(new Date())}</span>
        </div>

        {pathname !== '/pos' && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>New Sale</span>
          </Link>
        )}
      </div>
    </header>
  );
}
