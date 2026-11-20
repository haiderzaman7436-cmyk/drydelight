import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingCart, Calendar } from 'lucide-react';
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

export default function TopBar({ onOpenMobileMenu }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Dry Delight POS';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(new Date())}</span>
        </div>

        {pathname !== '/pos' && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">New Sale</span>
          </Link>
        )}
      </div>
    </header>
  );
}
