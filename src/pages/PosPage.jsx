import { memo, useState, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import {
  Barcode,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  User,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StockBadge from '../components/common/StockBadge';
import { findProductByBarcode } from '../services/productService';
import { createSale } from '../services/salesService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useData } from '../contexts/DataContext';
import { usePrint } from '../contexts/PrintContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { calculateSaleTotals } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { createClientRequestId } from '../utils/ids';

const PosProductCard = memo(function PosProductCard({ prod, cartQty, currency, onSelect }) {
  const stock = Number(prod.availableQuantity || 0);
  const outOfStock = stock <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={() => onSelect(prod)}
      className={`text-left p-3 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
        outOfStock
          ? 'bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed'
          : cartQty > 0
            ? 'bg-blue-50/60 border-blue-400 hover:border-blue-500'
            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-slate-900 line-clamp-2">{prod.name}</p>
          {cartQty > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold shrink-0">
              ×{cartQty}
            </span>
          )}
        </div>
        <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
          {prod.sku}
          {prod.barcode ? ` · ${prod.barcode}` : ''}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <span className="text-sm font-bold text-slate-900">
          {formatCurrency(prod.sellingPrice, currency)}
        </span>
        <StockBadge quantity={stock} minStockLevel={prod.minStockLevel} compact />
      </div>
    </button>
  );
});

export default function PosPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const {
    products,
    categories,
    productByBarcode,
    catalogLoaded,
    upsertProductLocal,
    applyStockUpdatesLocal,
    refreshCatalog,
  } = useData();
  const { printReceipt } = usePrint();
  const currency = settings.currency || 'PKR';

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState(null);

  const requestIdRef = useRef(createClientRequestId('sale'));

  const addProductToCart = useCallback((product) => {
    const available = Number(product.availableQuantity || 0);
    if (available <= 0) {
      toast.error(`"${product.name}" is out of stock.`);
      return;
    }

    requestIdRef.current = createClientRequestId('sale');

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > available) {
          toast.error(`Only ${available} unit(s) of "${product.name}" available in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, availableQuantity: available }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku || '',
          barcode: product.barcode || '',
          unitPrice: Number(product.sellingPrice || 0),
          purchasePrice: Number(product.purchasePrice || 0),
          availableQuantity: available,
          quantity: 1,
        },
      ];
    });
  }, []);

  // O(1) instant barcode lookup from DataContext Map, falling back to Firestore only if missing
  const handleBarcodeScan = useCallback(
    async (code) => {
      let matched = productByBarcode.get(code);
      if (!matched) {
        try {
          matched = await findProductByBarcode(code);
          if (matched) upsertProductLocal(matched);
        } catch (err) {
          console.error('Barcode lookup error:', err);
        }
      }

      if (!matched) {
        toast.error(`Unknown barcode: "${code}"`, { id: 'pos-unknown-barcode' });
        return;
      }

      addProductToCart(matched);
    },
    [productByBarcode, upsertProductLocal, addProductToCart]
  );

  const scanner = useBarcodeScanner({
    onScan: handleBarcodeScan,
    autoFocus: true,
    debounceMs: 80,
  });

  const handleSelectProductCard = useCallback(
    (prod) => {
      addProductToCart(prod);
      scanner.focusInput();
    },
    [addProductToCart, scanner.focusInput]
  );

  const updateCartQuantity = (productId, nextQty) => {
    const qty = Math.floor(Number(nextQty));
    requestIdRef.current = createClientRequestId('sale');

    if (!Number.isFinite(qty) || qty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (qty > item.availableQuantity) {
          toast.error(`Max available stock for "${item.productName}" is ${item.availableQuantity}.`);
          return { ...item, quantity: item.availableQuantity };
        }
        return { ...item, quantity: qty };
      })
    );
  };

  const removeFromCart = (productId) => {
    requestIdRef.current = createClientRequestId('sale');
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    scanner.focusInput();
  };

  const clearCart = () => {
    requestIdRef.current = createClientRequestId('sale');
    setCart([]);
    setCustomerName('');
    setPaidInput('');
    scanner.focusInput();
  };

  const cartQtyById = useMemo(() => {
    const map = new Map();
    for (const item of cart) map.set(item.productId, item.quantity);
    return map;
  }, [cart]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, deferredSearch, selectedCategory]);

  const totals = useMemo(
    () =>
      calculateSaleTotals({
        items: cart,
        paidAmount: paidInput === '' ? undefined : Number(paidInput),
      }),
    [cart, paidInput]
  );

  const handleCompleteSale = async ({ shouldPrint }) => {
    if (cart.length === 0) {
      toast.error('Add at least one product to the cart.');
      scanner.focusInput();
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const created = await createSale(
        {
          items: cart,
          customerName: customerName.trim() || 'Walk-in Customer',
          paidAmount: totals.paidAmount,
          clientRequestId: requestIdRef.current,
        },
        user
      );

      toast.success(`Sale ${created.invoiceNumber} completed!`);
      setLastCompletedSale(created);

      // Instant in-memory stock update across the whole app
      if (created.stockUpdates?.length) {
        applyStockUpdatesLocal(created.stockUpdates);
      }

      requestIdRef.current = createClientRequestId('sale');
      setCart([]);
      setCustomerName('');
      setPaidInput('');

      if (shouldPrint) {
        await printReceipt(created, 'sale');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Checkout failed. Please try again.');
      refreshCatalog();
    } finally {
      setSubmitting(false);
      scanner.focusInput();
    }
  };

  if (!catalogLoaded) return <LoadingSpinner label="Preparing POS terminal..." />;

  return (
    <div className="space-y-4">
      {lastCompletedSale && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Last Invoice:{' '}
              <strong className="font-mono">{lastCompletedSale.invoiceNumber}</strong> ·{' '}
              {lastCompletedSale.customerName} ·{' '}
              <strong>{formatCurrency(lastCompletedSale.grandTotal, currency)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => printReceipt(lastCompletedSale, 'sale')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            Reprint Receipt
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white border-2 border-blue-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="pos-barcode-input"
                className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"
              >
                <Barcode className="w-4 h-4" />
                USB Barcode Scanner Ready
              </label>
              <span className="text-[11px] text-slate-400">
                Scan barcode or type &amp; press Enter
              </span>
            </div>
            <input
              id="pos-barcode-input"
              ref={scanner.inputRef}
              type="text"
              value={scanner.value}
              onChange={(e) => scanner.setValue(e.target.value)}
              onKeyDown={scanner.handleKeyDown}
              disabled={scanner.scanning}
              placeholder="Focus stays here — scan product barcode..."
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Manual product search by name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              {sortedCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pr-1 pt-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-10 text-center text-xs text-slate-500">
                  No products match your search.
                </div>
              ) : (
                filteredProducts.map((prod) => (
                  <PosProductCard
                    key={prod.id}
                    prod={prod}
                    cartQty={cartQtyById.get(prod.id) || 0}
                    currency={currency}
                    onSelect={handleSelectProductCard}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden sticky top-20">
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Current Cart ({totals.totalItems})
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name (default: Walk-in Customer)"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-slate-400">
                Scan a barcode or click a product to add it to the cart.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="px-4 py-3 flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatCurrency(item.unitPrice, currency)} each · Stock: {item.availableQuantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-md border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.availableQuantity}
                      value={item.quantity}
                      onChange={(e) => updateCartQuantity(item.productId, e.target.value)}
                      className="w-11 text-center text-xs font-semibold py-1 border border-slate-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-md border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <p className="text-xs font-bold text-slate-900">
                      {formatCurrency(item.unitPrice * item.quantity, currency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(totals.subtotal, currency)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
                <span>Grand Total</span>
                <span className="text-blue-700">
                  {formatCurrency(totals.grandTotal, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label htmlFor="pos-paid" className="text-slate-600">
                  Paid Amount ({currency})
                </label>
                <input
                  id="pos-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  placeholder={String(totals.grandTotal)}
                  className="w-28 text-right px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>

              {totals.remainingAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Remaining Balance</span>
                  <span>{formatCurrency(totals.remainingAmount, currency)}</span>
                </div>
              )}

              {totals.changeAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Change Due</span>
                  <span>{formatCurrency(totals.changeAmount, currency)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => handleCompleteSale({ shouldPrint: true })}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                {submitting ? 'Processing Sale...' : 'Complete Sale & Print'}
              </button>
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => handleCompleteSale({ shouldPrint: false })}
                className="py-2 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Save Sale Without Printing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
