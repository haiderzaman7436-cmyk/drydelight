import { useEffect, useState, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { Search, RotateCcw, Printer, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import { getSaleByInvoiceNumber, getRecentSales } from '../services/salesService';
import { createSalesReturn, getRecentReturns } from '../services/returnService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useData } from '../contexts/DataContext';
import { usePrint } from '../contexts/PrintContext';
import { validateAndBuildReturn } from '../utils/calculations';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { createClientRequestId } from '../utils/ids';

const PAGE_SIZE = 12;

export default function SalesReturnsPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { applyStockUpdatesLocal } = useData();
  const { printReceipt } = usePrint();
  const currency = settings.currency || 'PKR';

  const [activeTab, setActiveTab] = useState('process');

  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [originalSale, setOriginalSale] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastReturn, setLastReturn] = useState(null);
  const requestIdRef = useRef(createClientRequestId('ret'));

  const [returnsHistory, setReturnsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const deferredHistorySearch = useDeferredValue(historySearch);
  const [historyPage, setHistoryPage] = useState(1);
  const [viewReturn, setViewReturn] = useState(null);

  const loadHistoryAndRecent = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [rets, sales] = await Promise.all([
        getRecentReturns(200),
        getRecentSales(25),
      ]);
      setReturnsHistory(rets);
      setRecentInvoices(sales.filter((s) => s.returnStatus !== 'full'));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load returns data');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistoryAndRecent();
  }, [loadHistoryAndRecent]);

  const selectSaleForReturn = (sale) => {
    setOriginalSale(sale);
    setInvoiceQuery(sale.invoiceNumber);
    const initQty = {};
    for (const item of sale.items || []) {
      initQty[item.productId] = 0;
    }
    setReturnQuantities(initQty);
    setReason('');
    requestIdRef.current = createClientRequestId('ret');
  };

  const handleSearchInvoice = async (e) => {
    e.preventDefault();
    const code = invoiceQuery.trim().toUpperCase();
    if (!code) {
      toast.error('Enter an invoice number to search');
      return;
    }

    // Check recentInvoices in memory first before hitting Firestore
    const localHit = recentInvoices.find((s) => s.invoiceNumber?.toUpperCase() === code);
    if (localHit) {
      selectSaleForReturn(localHit);
      return;
    }

    setSearching(true);
    try {
      const found = await getSaleByInvoiceNumber(code);
      if (!found) {
        toast.error(`No invoice found matching "${code}"`);
        setOriginalSale(null);
      } else {
        selectSaleForReturn(found);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to lookup invoice');
    } finally {
      setSearching(false);
    }
  };

  const handleReturnQtyChange = (productId, maxReturnable, rawVal) => {
    const val = Math.max(0, Math.floor(Number(rawVal) || 0));
    setReturnQuantities((prev) => ({ ...prev, [productId]: Math.min(maxReturnable, val) }));
    requestIdRef.current = createClientRequestId('ret');
  };

  const handleReturnAllRemaining = () => {
    if (!originalSale) return;
    const next = {};
    for (const item of originalSale.items || []) {
      next[item.productId] = Math.max(
        0,
        Number(item.quantity || 0) - Number(item.returnedQuantity || 0)
      );
    }
    setReturnQuantities(next);
    requestIdRef.current = createClientRequestId('ret');
  };

  const returnPreview = useMemo(() => {
    if (!originalSale) return null;
    const requestedReturns = Object.entries(returnQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, returnQuantity]) => ({ productId, returnQuantity }));

    if (requestedReturns.length === 0) {
      return { valid: false, totalReturnAmount: 0, totalReturnedQty: 0 };
    }

    try {
      const res = validateAndBuildReturn({ originalSale, requestedReturns });
      return { valid: true, ...res };
    } catch (err) {
      return { valid: false, error: err.message, totalReturnAmount: 0, totalReturnedQty: 0 };
    }
  }, [originalSale, returnQuantities]);

  const handleProcessReturn = async ({ shouldPrint }) => {
    if (!originalSale || !returnPreview?.valid) {
      toast.error(returnPreview?.error || 'Select at least one product to return.');
      return;
    }

    setSubmitting(true);
    try {
      const requestedReturns = Object.entries(returnQuantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([productId, returnQuantity]) => ({ productId, returnQuantity }));

      const { returnDoc, updatedSale, stockUpdates } = await createSalesReturn(
        {
          originalSaleId: originalSale.id,
          requestedReturns,
          reason,
          clientRequestId: requestIdRef.current,
        },
        user
      );

      toast.success(`Return ${returnDoc.returnInvoiceNumber} processed & stock restored!`);
      setLastReturn(returnDoc);

      // Update all local states & global stock immediately (0 extra Firestore queries)
      applyStockUpdatesLocal(stockUpdates);
      setReturnsHistory((prev) => [returnDoc, ...prev]);

      if (updatedSale) {
        selectSaleForReturn(updatedSale);
        setRecentInvoices((prev) =>
          updatedSale.returnStatus === 'full'
            ? prev.filter((s) => s.id !== updatedSale.id)
            : prev.map((s) => (s.id === updatedSale.id ? updatedSale : s))
        );
      }

      if (shouldPrint) {
        await printReceipt(returnDoc, 'return');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = deferredHistorySearch.trim().toLowerCase();
    if (!q) return returnsHistory;
    return returnsHistory.filter(
      (r) =>
        r.returnInvoiceNumber?.toLowerCase().includes(q) ||
        r.originalInvoiceNumber?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q)
    );
  }, [returnsHistory, deferredHistorySearch]);

  useEffect(() => {
    setHistoryPage(1);
  }, [deferredHistorySearch]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  return (
    <div className="space-y-5">
      <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('process')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'process'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Process Return
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Returns History ({returnsHistory.length})
        </button>
      </div>

      {lastReturn && activeTab === 'process' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Return Completed:{' '}
              <strong className="font-mono">{lastReturn.returnInvoiceNumber}</strong> for{' '}
              <span className="font-mono">{lastReturn.originalInvoiceNumber}</span> · Refund:{' '}
              <strong>{formatCurrency(lastReturn.totalReturnAmount, currency)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => printReceipt(lastReturn, 'return')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            Reprint Return Receipt
          </button>
        </div>
      )}

      {activeTab === 'process' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-4">
            <form
              onSubmit={handleSearchInvoice}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="Enter exact Original Invoice Number (e.g., INV-20261118-0001)"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Find Invoice'}
              </button>
            </form>

            {originalSale ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-mono">
                      {originalSale.invoiceNumber}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customer: <strong>{originalSale.customerName}</strong> · Sold on{' '}
                      {formatDateTime(originalSale.createdAt)} · Invoice Total:{' '}
                      <strong>{formatCurrency(originalSale.grandTotal, currency)}</strong>
                    </p>
                  </div>

                  {originalSale.returnStatus !== 'full' && (
                    <button
                      type="button"
                      onClick={handleReturnAllRemaining}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      Select Full Remaining Return
                    </button>
                  )}
                </div>

                {originalSale.returnStatus === 'full' ? (
                  <div className="p-6 flex items-center gap-3 text-sm text-amber-800 bg-amber-50/60">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>All items on this invoice have already been fully returned.</span>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-3 font-semibold">Product</th>
                            <th className="px-3 py-3 font-semibold text-center">Sold</th>
                            <th className="px-3 py-3 font-semibold text-center">Prev Returned</th>
                            <th className="px-3 py-3 font-semibold text-center">Returnable</th>
                            <th className="px-3 py-3 font-semibold text-right">Unit Price</th>
                            <th className="px-3 py-3 font-semibold text-center">Return Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(originalSale.items || []).map((item) => {
                            const sold = Number(item.quantity || 0);
                            const prevRet = Number(item.returnedQuantity || 0);
                            const returnable = Math.max(0, sold - prevRet);
                            const currentVal = returnQuantities[item.productId] || 0;

                            return (
                              <tr key={item.productId}>
                                <td className="px-3 py-3">
                                  <p className="font-semibold text-slate-900">{item.productName}</p>
                                  <p className="font-mono text-[10px] text-slate-400">
                                    {item.sku || item.barcode}
                                  </p>
                                </td>
                                <td className="px-3 py-3 text-center font-medium">{sold}</td>
                                <td className="px-3 py-3 text-center text-red-600">{prevRet}</td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-900">
                                  {returnable}
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {formatCurrency(item.unitPrice, currency)}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={returnable}
                                    disabled={returnable === 0}
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleReturnQtyChange(
                                        item.productId,
                                        returnable,
                                        e.target.value
                                      )
                                    }
                                    className="w-16 text-center py-1 px-2 border border-slate-300 rounded-md font-semibold disabled:bg-slate-100"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Return Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g., Defective item, wrong size, customer changed mind"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase font-semibold">
                            Total Refund Amount
                          </p>
                          <p className="text-xs text-slate-500">
                            {returnPreview?.totalReturnedQty || 0} unit(s) returning to stock
                          </p>
                        </div>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(returnPreview?.totalReturnAmount || 0, currency)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={submitting || !returnPreview?.valid}
                        onClick={() => handleProcessReturn({ shouldPrint: false })}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Save Return Only
                      </button>
                      <button
                        type="button"
                        disabled={submitting || !returnPreview?.valid}
                        onClick={() => handleProcessReturn({ shouldPrint: true })}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        {submitting ? 'Processing Return...' : 'Confirm Return & Print Receipt'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl">
                <EmptyState
                  icon={RotateCcw}
                  title="Lookup an invoice to begin a return"
                  description="Enter the original invoice number above or pick a recent invoice from the right panel. Original sales are preserved intact."
                />
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Recent Returnable Invoices
              </h3>
            </div>
            {loadingHistory && recentInvoices.length === 0 ? (
              <LoadingSpinner label="Loading recent invoices..." compact />
            ) : recentInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No recent returnable invoices found.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {recentInvoices.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => selectSaleForReturn(s)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 ${
                        originalSale?.id === s.id ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {s.invoiceNumber}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {s.customerName} · {s.saleDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-900">
                          {formatCurrency(s.grandTotal, currency)}
                        </p>
                        {s.returnStatus === 'partial' && (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Partial Return
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by return #, original invoice #, or customer..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {loadingHistory && returnsHistory.length === 0 ? (
            <LoadingSpinner label="Loading returns history..." />
          ) : paginatedHistory.length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title="No return invoices found"
              description="Processed sales returns will appear here."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2 font-semibold">Return #</th>
                      <th className="px-3.5 py-2 font-semibold">Original Invoice</th>
                      <th className="px-3.5 py-2 font-semibold">Date &amp; Time</th>
                      <th className="px-3.5 py-2 font-semibold">Customer</th>
                      <th className="px-3.5 py-2 font-semibold text-center">Qty Returned</th>
                      <th className="px-3.5 py-2 font-semibold text-right">Refund Total</th>
                      <th className="px-3.5 py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedHistory.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3.5 py-2 font-mono font-semibold text-red-700">
                          {r.returnInvoiceNumber}
                        </td>
                        <td className="px-3.5 py-2 font-mono text-slate-700">
                          {r.originalInvoiceNumber}
                        </td>
                        <td className="px-3.5 py-2 text-slate-500 whitespace-nowrap text-[11px]">
                          {formatDateTime(r.createdAt)}
                        </td>
                        <td className="px-3.5 py-2 font-medium text-slate-800">{r.customerName}</td>
                        <td className="px-3.5 py-2 text-center font-semibold">
                          {r.totalReturnedQty}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-red-700">
                          {formatCurrency(r.totalReturnAmount, currency)}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewReturn(r)}
                              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="View return details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => printReceipt(r, 'return')}
                              className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Print 58mm return invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={historyPage}
                totalItems={filteredHistory.length}
                pageSize={PAGE_SIZE}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(viewReturn)}
        onClose={() => setViewReturn(null)}
        title={`Return Invoice ${viewReturn?.returnInvoiceNumber || ''}`}
        subtitle={`Original Invoice: ${viewReturn?.originalInvoiceNumber || ''} · ${formatDateTime(viewReturn?.createdAt)}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setViewReturn(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => viewReturn && printReceipt(viewReturn, 'return')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Return Receipt
            </button>
          </>
        }
      >
        {viewReturn && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Customer: <strong className="text-slate-900">{viewReturn.customerName}</strong>
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewReturn.items || []).map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="px-3 py-2 text-center">{item.returnQuantity}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(item.unitPrice, currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-red-700">
                        {formatCurrency(item.lineReturnTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
              <span>Total Refund Amount</span>
              <span className="text-red-700">
                {formatCurrency(viewReturn.totalReturnAmount, currency)}
              </span>
            </div>
            {viewReturn.reason && (
              <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <strong>Reason:</strong> {viewReturn.reason}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
