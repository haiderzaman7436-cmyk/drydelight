import { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Package,
  Boxes,
  Banknote,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
  Search,
  RefreshCw,
  Barcode,
  ArrowRight,
  Plus,
  Minus,
  LayoutGrid,
  List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { downloadBarcodesPdf } from '../utils/barcodePdfGenerator';
import { getProductImage } from '../utils/productImages';
import { adjustProductStock } from '../services/productService';
import { getRecentStockMovements } from '../services/inventoryService';
import { invalidateCachePrefix } from '../services/queryCache';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/formatters';

const MOVEMENT_BADGES = {
  SALE: { label: 'Sale', className: 'bg-blue-50 text-blue-700' },
  SALE_RETURN: { label: 'Return', className: 'bg-emerald-50 text-emerald-700' },
  SALE_EDIT: { label: 'Sale Edit', className: 'bg-indigo-50 text-indigo-700' },
  SALE_DELETE: { label: 'Sale Delete', className: 'bg-amber-50 text-amber-800' },
  RESTOCK: { label: 'Restock', className: 'bg-emerald-50 text-emerald-700' },
  STOCK_DEDUCTION: { label: 'Deduction', className: 'bg-red-50 text-red-700' },
  INITIAL_STOCK: { label: 'Initial', className: 'bg-slate-100 text-slate-700' },
  MANUAL_ADJUSTMENT: { label: 'Manual Edit', className: 'bg-slate-100 text-slate-700' },
};

const PAGE_SIZE = 15;
const GRID_PAGE_SIZE = 24;

export default function InventoryPage() {
  const { user, isManagerOrAdmin } = useAuth();
  const { settings } = useSettings();
  const {
    products,
    categories,
    catalogLoaded,
    productById,
    applyStockUpdatesLocal,
    refreshCatalog,
  } = useData();
  const currency = settings.currency || 'PKR';

  const [activeTab, setActiveTab] = useState('overview');
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const deferredLedgerSearch = useDeferredValue(ledgerSearch);
  const [ledgerCategory, setLedgerCategory] = useState('all');
  const [ledgerStockFilter, setLedgerStockFilter] = useState('all');
  const [ledgerView, setLedgerView] = useState('grid');
  const [ledgerPage, setLedgerPage] = useState(1);

  const [movementSearch, setMovementSearch] = useState('');
  const deferredMovementSearch = useDeferredValue(movementSearch);
  const [movementType, setMovementType] = useState('all');
  const [movementPage, setMovementPage] = useState(1);

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadMovements = useCallback(async (force = false) => {
    if (force) invalidateCachePrefix('movements:');
    setLoadingMovements(true);
    try {
      const movs = await getRecentStockMovements(200);
      setMovements(movs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load stock movements');
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  // Only fetch movements when the user switches to the Movements tab
  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements(false);
    }
  }, [activeTab, loadMovements]);

  const metrics = useMemo(() => {
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    const categoryMap = new Map();

    for (const p of products) {
      const qty = Number(p.availableQuantity || 0);
      const min = Number(p.minStockLevel || 0);
      totalUnits += qty;
      if (qty === 0) outOfStockCount += 1;
      if (qty <= min) lowStockCount += 1;
      totalCostValue += qty * Number(p.purchasePrice || 0);
      totalRetailValue += qty * Number(p.sellingPrice || 0);

      const catName = p.categoryName || 'Uncategorized';
      const entry = categoryMap.get(catName) || {
        categoryName: catName,
        productCount: 0,
        totalStock: 0,
        lowStockCount: 0,
        stockValue: 0,
      };
      entry.productCount += 1;
      entry.totalStock += qty;
      if (qty <= min) entry.lowStockCount += 1;
      entry.stockValue += qty * Number(p.sellingPrice || 0);
      categoryMap.set(catName, entry);
    }

    return {
      totalProducts: products.length,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      totalCostValue,
      totalRetailValue,
      categoryBreakdown: Array.from(categoryMap.values()).sort(
        (a, b) => b.totalStock - a.totalStock
      ),
    };
  }, [products]);

  const lowAndOutProducts = useMemo(
    () =>
      products
        .filter((p) => Number(p.availableQuantity || 0) <= Number(p.minStockLevel || 0))
        .sort((a, b) => Number(a.availableQuantity || 0) - Number(b.availableQuantity || 0)),
    [products]
  );

  const sortedLedgerProducts = useMemo(() => {
    const q = deferredLedgerSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      if (ledgerCategory !== 'all' && p.categoryId !== ledgerCategory) return false;
      const qty = Number(p.availableQuantity || 0);
      const min = Number(p.minStockLevel || 0);
      if (ledgerStockFilter === 'low' && (qty === 0 || qty > min)) return false;
      if (ledgerStockFilter === 'out' && qty > 0) return false;
      if (ledgerStockFilter === 'healthy' && qty <= min) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, deferredLedgerSearch, ledgerCategory, ledgerStockFilter]);

  useEffect(() => {
    setLedgerPage(1);
  }, [deferredLedgerSearch, ledgerCategory, ledgerStockFilter, ledgerView]);

  const paginatedLedgerProducts = useMemo(() => {
    const start = (ledgerPage - 1) * GRID_PAGE_SIZE;
    return sortedLedgerProducts.slice(start, start + GRID_PAGE_SIZE);
  }, [sortedLedgerProducts, ledgerPage]);

  const filteredMovements = useMemo(() => {
    const q = deferredMovementSearch.trim().toLowerCase();
    return movements.filter((m) => {
      if (movementType !== 'all' && m.transactionType !== movementType) return false;
      if (!q) return true;
      return (
        m.productName?.toLowerCase().includes(q) ||
        m.sku?.toLowerCase().includes(q) ||
        m.referenceInvoice?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q)
      );
    });
  }, [movements, deferredMovementSearch, movementType]);

  useEffect(() => {
    setMovementPage(1);
  }, [deferredMovementSearch, movementType]);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [filteredMovements, movementPage]);

  const openAdjustModal = (prod) => {
    setAdjustTarget(prod);
    setAdjustMode('add');
    setAdjustQty('');
    setAdjustReason('');
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const qty = Math.floor(Number(adjustQty) || 0);
    if (qty <= 0) {
      toast.error('Enter a quantity greater than 0');
      return;
    }

    setAdjusting(true);
    try {
      const delta = adjustMode === 'add' ? qty : -qty;
      const res = await adjustProductStock(
        {
          productId: adjustTarget.id,
          delta,
          reason: adjustReason,
          reference: adjustMode === 'add' ? 'RESTOCK' : 'DEDUCTION',
        },
        user
      );
      applyStockUpdatesLocal([{ productId: adjustTarget.id, newStock: res.newStock }]);
      toast.success(`Stock updated for ${adjustTarget.name}`);
      setAdjustTarget(null);
      if (activeTab === 'movements') loadMovements(true);
    } catch (err) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  if (!catalogLoaded) return <LoadingSpinner label="Loading inventory..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3.5 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate">
              {formatNumber(metrics.totalProducts)}
            </p>
            <p className="text-xs font-medium text-blue-100">Total Products</p>
            <p className="text-[11px] text-blue-100/80 mt-0.5 truncate">
              Cost: {formatCurrency(metrics.totalCostValue, currency)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3.5 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Banknote className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate">
              {formatCurrency(metrics.totalRetailValue, currency)}
            </p>
            <p className="text-xs font-medium text-amber-50">Stock Value</p>
            <p className="text-[11px] text-amber-100/90 mt-0.5 truncate">
              Est. margin: {formatCurrency(metrics.totalRetailValue - metrics.totalCostValue, currency)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3.5 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate">
              {formatNumber(metrics.totalUnits)} pcs
            </p>
            <p className="text-xs font-medium text-emerald-100">Total Stock Units</p>
            <p className="text-[11px] text-emerald-100/85 mt-0.5 truncate">
              Across {metrics.categoryBreakdown.length} categories
            </p>
          </div>
        </div>

        <div
          className={`rounded-xl text-white p-3.5 shadow-sm flex items-center gap-3.5 ${
            metrics.lowStockCount > 0
              ? 'bg-gradient-to-br from-violet-600 to-purple-700'
              : 'bg-gradient-to-br from-slate-700 to-slate-800'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight truncate">
              {formatNumber(metrics.lowStockCount)}
            </p>
            <p className="text-xs font-medium text-purple-100">Low Stock Items</p>
            <p className="text-[11px] text-purple-100/85 mt-0.5 truncate">
              {metrics.outOfStockCount} out of stock
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Category &amp; Stock Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'movements'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock Movement History
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const targetList = sortedLedgerProducts.length > 0 ? sortedLedgerProducts : products;
              if (targetList.length === 0) {
                toast.error('No products available to export barcode PDF');
                return;
              }
              downloadBarcodesPdf(targetList, {
                storeName: settings.storeName || 'DRY DELIGHT',
                currency: settings.currency || 'PKR',
                filename: 'Dry_Delight_Product_Barcodes.pdf',
              });
              toast.success(`Generated PDF for ${targetList.length} barcode labels`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
            title="Download printable A4 sticker barcode labels PDF"
          >
            <Barcode className="w-3.5 h-3.5" />
            Barcode Stickers PDF
          </button>

          <button
            type="button"
            onClick={() => {
              refreshCatalog();
              if (activeTab === 'movements') loadMovements(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Category-Wise Stock</h3>
            </div>
            {metrics.categoryBreakdown.length === 0 ? (
              <EmptyState title="No inventory yet" description="Add products to see category stock breakdown." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2 font-semibold">Category</th>
                      <th className="px-3.5 py-2 font-semibold text-center">Products</th>
                      <th className="px-3.5 py-2 font-semibold text-right">Units</th>
                      <th className="px-3.5 py-2 font-semibold text-center">Low Stock</th>
                      <th className="px-3.5 py-2 font-semibold text-right">Retail Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.categoryBreakdown.map((row) => (
                      <tr key={row.categoryName} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3.5 py-2 font-semibold text-slate-900">
                          {row.categoryName}
                        </td>
                        <td className="px-3.5 py-2 text-center text-slate-600">
                          {row.productCount}
                        </td>
                        <td className="px-3.5 py-2 text-right font-semibold text-slate-800">
                          {formatNumber(row.totalStock)}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          {row.lowStockCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                              {row.lowStockCount}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium text-[11px]">OK</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right font-medium text-slate-900">
                          {formatCurrency(row.stockValue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#0f2347] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Stock Alerts</h3>
              </div>
              <span className="text-xs text-slate-200 font-medium">
                {lowAndOutProducts.length} item(s)
              </span>
            </div>
            {lowAndOutProducts.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-emerald-700 bg-emerald-50/30">
                All products have healthy inventory levels.
              </div>
            ) : (
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {lowAndOutProducts.map((p) => {
                  const qty = Number(p.availableQuantity || 0);
                  const isOut = qty === 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors ${
                        isOut
                          ? 'bg-red-50/80 border-red-200/80'
                          : 'bg-rose-50/70 border-rose-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getProductImage(p)}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p
                            className={`text-[11px] font-semibold mt-0.5 ${
                              isOut ? 'text-red-700' : 'text-rose-600'
                            }`}
                          >
                            {isOut
                              ? `Out of stock (Min: ${p.minStockLevel})`
                              : `Only ${qty} left (Min: ${p.minStockLevel})`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white ${
                            isOut ? 'bg-red-600' : 'bg-rose-600'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : 'Low Stock'}
                        </span>
                        {isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => openAdjustModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 font-semibold text-xs shadow-2xs"
                          >
                            <ArrowUpDown className="w-3 h-3 text-blue-600" />
                            Adjust
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/40">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Visual Inventory Showcase
                </h3>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {sortedLedgerProducts.length} items
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Filter by name, SKU, barcode..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <select
                  value={ledgerCategory}
                  onChange={(e) => setLedgerCategory(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={ledgerStockFilter}
                  onChange={(e) => setLedgerStockFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none"
                >
                  <option value="all">All Stock Status</option>
                  <option value="healthy">In Stock Only</option>
                  <option value="low">Low Stock Only</option>
                  <option value="out">Out of Stock</option>
                </select>

                <div className="inline-flex bg-white border border-slate-300 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setLedgerView('grid')}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      ledgerView === 'grid'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Photo Cards View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerView('table')}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      ledgerView === 'table'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Compact Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                    Table
                  </button>
                </div>
              </div>
            </div>

            {paginatedLedgerProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No products match your filter.
              </div>
            ) : ledgerView === 'grid' ? (
              <>
                <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {paginatedLedgerProducts.map((p) => {
                    const qty = Number(p.availableQuantity || 0);
                    const min = Number(p.minStockLevel || 0);
                    const isOut = qty === 0;
                    const isLow = qty > 0 && qty <= min;
                    const stockVal = qty * Number(p.sellingPrice || 0);

                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl border bg-white p-2.5 flex flex-col justify-between gap-2 transition-all hover:shadow-sm ${
                          isOut
                            ? 'border-red-200 bg-red-50/20'
                            : isLow
                              ? 'border-amber-200 bg-amber-50/15'
                              : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-medium text-slate-400 truncate">
                              {p.categoryName}
                            </span>
                            {isOut ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shrink-0">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shrink-0">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                                In Stock
                              </span>
                            )}
                          </div>

                          <div className="w-full h-36 sm:h-40 rounded-xl bg-white border border-slate-100 flex items-center justify-center p-2 overflow-hidden">
                            <img
                              src={getProductImage(p)}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          <p
                            className="text-xs font-bold text-slate-900 mt-2 line-clamp-2 leading-tight text-center"
                            title={p.name}
                          >
                            {p.name}
                          </p>
                          <p
                            className={`text-[11px] font-semibold text-center mt-0.5 ${
                              isOut
                                ? 'text-red-600'
                                : isLow
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {isOut ? '0 pcs left' : isLow ? `Only ${qty} left` : `${qty} pcs`}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Stock Value</span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(stockVal, currency)}
                            </span>
                          </div>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => openAdjustModal(p)}
                              className="w-full py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-700 text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                              Adjust Stock
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={ledgerPage}
                  totalItems={sortedLedgerProducts.length}
                  pageSize={GRID_PAGE_SIZE}
                  onPageChange={setLedgerPage}
                />
              </>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2 font-semibold">Product</th>
                        <th className="px-3.5 py-2 font-semibold">Barcode</th>
                        <th className="px-3.5 py-2 font-semibold">Category</th>
                        <th className="px-3.5 py-2 font-semibold text-center">Available</th>
                        <th className="px-3.5 py-2 font-semibold text-center">Min Level</th>
                        <th className="px-3.5 py-2 font-semibold text-right">Selling Price</th>
                        <th className="px-3.5 py-2 font-semibold text-right">Stock Value</th>
                        {isManagerOrAdmin && (
                          <th className="px-3.5 py-2 font-semibold text-right">Adjust</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLedgerProducts.map((p) => {
                        const qty = Number(p.availableQuantity || 0);
                        const min = Number(p.minStockLevel || 0);
                        const isOut = qty === 0;
                        const isLow = qty > 0 && qty <= min;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3.5 py-2">
                              <div className="flex items-center gap-2">
                                <img
                                  src={getProductImage(p)}
                                  alt={p.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 leading-tight">
                                    {p.name}
                                  </span>
                                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                                    {p.sku}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600">
                              {p.barcode || '—'}
                            </td>
                            <td className="px-3.5 py-2 text-slate-600 text-[11px]">
                              {p.categoryName}
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  isOut
                                    ? 'bg-red-600 text-white'
                                    : isLow
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {qty} pcs
                              </span>
                            </td>
                            <td className="px-3.5 py-2 text-center text-slate-500 text-xs">
                              {p.minStockLevel}
                            </td>
                            <td className="px-3.5 py-2 text-right font-medium text-slate-800">
                              {formatCurrency(p.sellingPrice || 0, currency)}
                            </td>
                            <td className="px-3.5 py-2 text-right font-semibold text-slate-900">
                              {formatCurrency(qty * Number(p.sellingPrice || 0), currency)}
                            </td>
                            {isManagerOrAdmin && (
                              <td className="px-3.5 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openAdjustModal(p)}
                                  className="px-2 py-0.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
                                >
                                  Adjust Stock
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={ledgerPage}
                  totalItems={sortedLedgerProducts.length}
                  pageSize={GRID_PAGE_SIZE}
                  onPageChange={setLedgerPage}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                placeholder="Search by product, SKU, or reference invoice..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="all">All Transaction Types</option>
              {Object.entries(MOVEMENT_BADGES).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {loadingMovements && movements.length === 0 ? (
            <LoadingSpinner label="Loading stock movements..." />
          ) : paginatedMovements.length === 0 ? (
            <EmptyState
              title="No stock movements recorded"
              description="Sales, returns, and stock adjustments are automatically logged here."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold text-right">Change</th>
                      <th className="px-4 py-3 font-semibold text-right">Prev / New</th>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Notes / By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedMovements.map((m) => {
                      const badge = MOVEMENT_BADGES[m.transactionType] || {
                        label: m.transactionType,
                        className: 'bg-slate-100 text-slate-700',
                      };
                      const delta = Number(m.quantityChanged || 0);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {formatDateTime(m.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={getProductImage(
                                  productById?.get(m.productId) || { name: m.productName }
                                )}
                                alt={m.productName}
                                loading="lazy"
                                decoding="async"
                                className="w-11 h-11 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{m.productName}</p>
                                <p className="font-mono text-[11px] text-slate-400">{m.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              delta > 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            <span className="inline-flex items-center gap-1 justify-end">
                              {m.previousStock}
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <strong>{m.newStock}</strong>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {m.referenceInvoice || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                            {m.notes || m.performedBy || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={movementPage}
                totalItems={filteredMovements.length}
                pageSize={PAGE_SIZE}
                onPageChange={setMovementPage}
              />
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(adjustTarget)}
        onClose={() => !adjusting && setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.name || ''}`}
        subtitle={`Current available stock: ${adjustTarget?.availableQuantity ?? 0} unit(s)`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              disabled={adjusting}
              onClick={() => setAdjustTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="adjust-stock-form"
              disabled={adjusting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {adjusting ? 'Updating...' : 'Apply Adjustment'}
            </button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustMode('add')}
              className={`py-2 text-xs font-semibold rounded-lg border inline-flex items-center justify-center gap-1.5 ${
                adjustMode === 'add'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Stock (Restock)
            </button>
            <button
              type="button"
              onClick={() => setAdjustMode('deduct')}
              className={`py-2 text-xs font-semibold rounded-lg border inline-flex items-center justify-center gap-1.5 ${
                adjustMode === 'deduct'
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              Deduct Stock
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Note
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g., Supplier delivery, damaged unit..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
