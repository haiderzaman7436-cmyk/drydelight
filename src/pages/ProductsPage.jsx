import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Package,
  Wand2,
  Barcode,
  Filter,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import BarcodeDisplay from '../components/common/BarcodeDisplay';
import StockBadge from '../components/common/StockBadge';
import CatalogImportModal from '../components/inventory/CatalogImportModal';
import { createProduct, updateProduct, deleteProduct } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useData } from '../contexts/DataContext';
import { generateInternalBarcode, generateSku } from '../utils/barcode';
import { downloadBarcodesPdf } from '../utils/barcodePdfGenerator';
import scrapedCatalog from '../data/scrapedCatalog.json';
import { formatCurrency, formatDate } from '../utils/formatters';

const PAGE_SIZE = 15;

export default function ProductsPage() {
  const { user, isManagerOrAdmin } = useAuth();
  const { settings } = useSettings();
  const {
    products,
    categories,
    productByBarcode,
    catalogLoaded,
    upsertProductLocal,
    removeProductLocal,
  } = useData();
  const currency = settings.currency || 'PKR';

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    purchasePrice: '',
    sellingPrice: '',
    availableQuantity: '0',
    minStockLevel: '5',
    description: '',
  });

  const [viewProduct, setViewProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      const qty = Number(p.availableQuantity || 0);
      const min = Number(p.minStockLevel || 0);
      if (stockFilter === 'low' && qty > min) return false;
      if (stockFilter === 'out' && qty > 0) return false;

      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'price_asc':
          return Number(a.sellingPrice || 0) - Number(b.sellingPrice || 0);
        case 'price_desc':
          return Number(b.sellingPrice || 0) - Number(a.sellingPrice || 0);
        case 'stock_asc':
          return Number(a.availableQuantity || 0) - Number(b.availableQuantity || 0);
        case 'stock_desc':
          return Number(b.availableQuantity || 0) - Number(a.availableQuantity || 0);
        case 'newest':
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        case 'name_asc':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [products, deferredSearch, categoryFilter, stockFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryFilter, stockFilter, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const openCreateModal = () => {
    if (categories.length === 0) {
      toast.error('Please create at least one category before adding products.');
      return;
    }
    setEditing(null);
    setForm({
      name: '',
      sku: '',
      barcode: '',
      categoryId: categories[0]?.id || '',
      purchasePrice: '',
      sellingPrice: '',
      availableQuantity: '0',
      minStockLevel: String(settings.defaultMinStockLevel ?? 5),
      description: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (prod) => {
    setEditing(prod);
    setForm({
      name: prod.name || '',
      sku: prod.sku || '',
      barcode: prod.barcode || '',
      categoryId: prod.categoryId || categories[0]?.id || '',
      purchasePrice: String(prod.purchasePrice ?? 0),
      sellingPrice: String(prod.sellingPrice ?? 0),
      availableQuantity: String(prod.availableQuantity ?? 0),
      minStockLevel: String(prod.minStockLevel ?? 5),
      description: prod.description || '',
    });
    setFormOpen(true);
  };

  const handleGenerateBarcode = () => {
    let code = generateInternalBarcode();
    while (productByBarcode.has(code)) {
      code = generateInternalBarcode();
    }
    setForm((prev) => ({ ...prev, barcode: code }));
  };

  const handleGenerateSku = () => {
    setForm((prev) => ({ ...prev, sku: generateSku(prev.name || 'PRD') }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === form.categoryId);
    if (!cat) {
      toast.error('Please select a valid category');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, categoryName: cat.name };
      if (editing) {
        const updated = await updateProduct(editing.id, payload, user, editing);
        upsertProductLocal(updated);
        toast.success('Product updated');
      } else {
        const created = await createProduct(payload, user);
        upsertProductLocal(created);
        toast.success('Product created');
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      removeProductLocal(deleteTarget.id);
      toast.success('Product deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, or scan barcode..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const targetList =
                  products.length > 0
                    ? filteredProducts.length > 0
                      ? filteredProducts
                      : products
                    : scrapedCatalog.products;
                downloadBarcodesPdf(targetList, {
                  storeName: settings.storeName || 'DRY DELIGHT',
                  currency: settings.currency || 'PKR',
                  filename: 'Dry_Delight_Product_Barcodes.pdf',
                });
                toast.success(`Generated PDF for ${targetList.length} barcode labels`);
              }}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium transition-colors"
              title="Download printable A4 sticker barcode labels PDF"
            >
              <Barcode className="w-4 h-4" />
              Barcode Stickers PDF
            </button>

            {isManagerOrAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                  title="Import 372 items scraped from register photos"
                >
                  <UploadCloud className="w-4 h-4" />
                  Import Scraped Catalog
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            Filters:
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="all">All Stock Levels</option>
            <option value="low">Low Stock Only</option>
            <option value="out">Out of Stock Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="price_asc">Price (Low to High)</option>
            <option value="price_desc">Price (High to Low)</option>
            <option value="stock_asc">Stock (Lowest First)</option>
            <option value="stock_desc">Stock (Highest First)</option>
            <option value="newest">Newest Added</option>
          </select>

          <span className="ml-auto text-xs text-slate-500">
            {filteredProducts.length} product(s)
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {!catalogLoaded ? (
          <LoadingSpinner label="Loading products..." />
        ) : paginated.length === 0 ? (
          products.length === 0 ? (
            <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Your Catalog is Ready to Import</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                372 products and 11 categories have been scraped from your 32 register notebook photos with valid EAN-13 barcodes, stock quantities, and alphabetical sorting.
              </p>
              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  Import 372 Items Now
                </button>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No products found"
              description="Try clearing or adjusting your active search and filters."
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Product</th>
                    <th className="px-3.5 py-2.5 font-semibold">SKU / Barcode</th>
                    <th className="px-3.5 py-2.5 font-semibold">Category</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Purchase</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Selling</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Profit / Unit</th>
                    <th className="px-3.5 py-2.5 font-semibold text-center">Stock</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((prod) => {
                    const unitProfit =
                      Number(prod.sellingPrice || 0) - Number(prod.purchasePrice || 0);
                    return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2">
                        <p className="font-semibold text-slate-900 leading-tight">{prod.name}</p>
                        {prod.description && (
                          <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {prod.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3.5 py-2">
                        <p className="font-mono text-xs font-semibold text-slate-800">
                          {prod.sku}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500">
                          {prod.barcode || 'No barcode'}
                        </p>
                      </td>
                      <td className="px-3.5 py-2 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {prod.categoryName || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-right text-slate-600 font-medium">
                        {formatCurrency(prod.purchasePrice, currency)}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                        {formatCurrency(prod.sellingPrice, currency)}
                      </td>
                      <td
                        className={`px-3.5 py-2 text-right font-semibold ${
                          unitProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(unitProfit, currency)}
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        <StockBadge
                          quantity={prod.availableQuantity}
                          minStockLevel={prod.minStockLevel}
                          compact
                        />
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewProduct(prod)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isManagerOrAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(prod)}
                                className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Edit product"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(prod)}
                                className="p-1 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={filteredProducts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Edit Product' : 'Add New Product'}
        subtitle="Scan a USB barcode directly into the barcode field or generate a unique internal barcode."
        size="lg"
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Product' : 'Save Product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Basmati Rice 5kg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Code / SKU <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g., RICE-1001"
                  className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleGenerateSku}
                  className="px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                  title="Auto-generate SKU"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Barcode (Scan with USB scanner, type manually, or generate)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    placeholder="Scan or enter barcode..."
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shrink-0"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate EAN-13
                </button>
              </div>
              {form.barcode && (
                <div className="mt-2">
                  <BarcodeDisplay value={form.barcode} height={36} fontSize={11} />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Price ({currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price ({currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            {(form.purchasePrice !== '' || form.sellingPrice !== '') && (
              <div className="sm:col-span-2 px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Estimated Profit per Unit:</span>
                <span
                  className={`font-bold ${
                    Number(form.sellingPrice || 0) - Number(form.purchasePrice || 0) >= 0
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(
                    Number(form.sellingPrice || 0) - Number(form.purchasePrice || 0),
                    currency
                  )}
                  {Number(form.sellingPrice || 0) > 0 && (
                    <span className="ml-1.5 font-medium text-slate-500">
                      (
                      {(
                        ((Number(form.sellingPrice || 0) - Number(form.purchasePrice || 0)) /
                          Number(form.sellingPrice || 1)) *
                        100
                      ).toFixed(1)}
                      % margin)
                    </span>
                  )}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Available Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={form.availableQuantity}
                onChange={(e) => setForm({ ...form, availableQuantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Stock Level <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={form.minStockLevel}
                onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional product notes, pack size, supplier info..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(viewProduct)}
        onClose={() => setViewProduct(null)}
        title={viewProduct?.name || 'Product Details'}
        subtitle={`SKU: ${viewProduct?.sku || '—'} · Category: ${viewProduct?.categoryName || '—'}`}
      >
        {viewProduct && (
          <div className="space-y-4 text-sm">
            <div className="flex justify-center py-2">
              <BarcodeDisplay value={viewProduct.barcode} height={48} fontSize={12} />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
              <div>
                <p className="text-slate-500">Purchase Price</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {formatCurrency(viewProduct.purchasePrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Selling Price</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {formatCurrency(viewProduct.sellingPrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Available Stock</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {viewProduct.availableQuantity} unit(s)
                </p>
              </div>
              <div>
                <p className="text-slate-500">Minimum Stock Level</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {viewProduct.minStockLevel} unit(s)
                </p>
              </div>
              <div>
                <p className="text-slate-500">Unit Margin</p>
                <p className="font-semibold text-emerald-700 mt-0.5">
                  {formatCurrency(
                    Number(viewProduct.sellingPrice || 0) - Number(viewProduct.purchasePrice || 0),
                    currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Created On</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {formatDate(viewProduct.createdAt)}
                </p>
              </div>
            </div>

            {viewProduct.description && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Description</p>
                <p className="text-xs text-slate-700 leading-relaxed">{viewProduct.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}" (SKU: ${deleteTarget?.sku})? Past sales invoices will remain intact.`}
        confirmLabel="Delete Product"
        loading={deleting}
      />

      <CatalogImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
