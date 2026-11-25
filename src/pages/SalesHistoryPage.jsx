import { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Printer,
  Receipt,
  Plus,
  Minus,
  History,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import {
  getRecentSales,
  getSalesByDate,
  getSalesByMonth,
  updateSale,
  deleteSale,
  getSaleAuditLogs,
} from '../services/salesService';
import { getReturnsForSale } from '../services/returnService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useProfitLock } from '../contexts/ProfitLockContext';
import { useData } from '../contexts/DataContext';
import { usePrint } from '../contexts/PrintContext';
import { calculateSaleTotals, computeSaleProfit } from '../utils/calculations';
import {
  formatCurrency,
  formatDateTime,
  toLocalDateKey,
  toLocalMonthKey,
} from '../utils/formatters';

const PAGE_SIZE = 15;

export default function SalesHistoryPage() {
  const { user, isManagerOrAdmin } = useAuth();
  const { settings } = useSettings();
  const { isLocked, openUnlockModal } = useProfitLock();
  const { products: catalogProducts, applyStockUpdatesLocal } = useData();
  const { printReceipt } = usePrint();
  const currency = settings.currency || 'PKR';

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState('recent');
  const [dateFilter, setDateFilter] = useState(() => toLocalDateKey());
  const [monthFilter, setMonthFilter] = useState(() => toLocalMonthKey());
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  const [viewSale, setViewSale] = useState(null);
  const [viewReturns, setViewReturns] = useState([]);
  const [viewAuditLogs, setViewAuditLogs] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [editSale, setEditSale] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editCustomer, setEditCustomer] = useState('');
  const [editPaid, setEditPaid] = useState('0');
  const [editReason, setEditReason] = useState('');
  const [addProductId, setAddProductId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];
      if (filterMode === 'daily') {
        data = await getSalesByDate(dateFilter);
      } else if (filterMode === 'monthly') {
        data = await getSalesByMonth(monthFilter);
      } else {
        data = await getRecentSales(250);
      }
      setSales(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sales history');
    } finally {
      setLoading(false);
    }
  }, [filterMode, dateFilter, monthFilter]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return sales.filter((s) => {
      if (statusFilter !== 'all' && s.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        s.invoiceNumber?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q)
      );
    });
  }, [sales, deferredSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, statusFilter, filterMode, dateFilter, monthFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, page]);

  const openDetails = async (sale) => {
    setViewSale(sale);
    setViewReturns([]);
    setViewAuditLogs([]);
    setLoadingDetails(true);
    try {
      const [rets, logs] = await Promise.all([
        sale.returnStatus && sale.returnStatus !== 'none'
          ? getReturnsForSale(sale.id)
          : Promise.resolve([]),
        isManagerOrAdmin && sale.lastEditedAt
          ? getSaleAuditLogs(sale.id)
          : Promise.resolve([]),
      ]);
      setViewReturns(rets);
      setViewAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openEditModal = (sale) => {
    setEditSale(sale);
    setEditCustomer(sale.customerName || 'Walk-in Customer');
    setEditItems((sale.items || []).map((it) => ({ ...it })));
    setEditPaid(String(sale.paidAmount ?? sale.grandTotal ?? 0));
    setEditReason('');
    setAddProductId('');
  };

  const editTotals = useMemo(
    () =>
      calculateSaleTotals({
        items: editItems,
        paidAmount: editPaid === '' ? 0 : Number(editPaid),
      }),
    [editItems, editPaid]
  );

  const handleEditItemQty = (productId, nextQty) => {
    const qty = Math.floor(Number(nextQty) || 0);
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const minAllowed = Math.max(1, Number(item.returnedQuantity || 0));
        if (qty < minAllowed) {
          toast.error(
            item.returnedQuantity > 0
              ? `Cannot reduce below already-returned quantity (${item.returnedQuantity}).`
              : 'Minimum quantity is 1. Use the trash icon to remove.'
          );
          return { ...item, quantity: minAllowed };
        }
        return { ...item, quantity: qty };
      })
    );
  };

  const handleRemoveEditItem = (productId) => {
    const target = editItems.find((i) => i.productId === productId);
    if (target && Number(target.returnedQuantity || 0) > 0) {
      toast.error('Cannot remove an item that already has recorded returns.');
      return;
    }
    if (editItems.length <= 1) {
      toast.error('A sale must have at least one item. Delete the sale instead.');
      return;
    }
    setEditItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleAddProductToEdit = () => {
    if (!addProductId) return;
    const prod = catalogProducts.find((p) => p.id === addProductId);
    if (!prod) return;
    const exists = editItems.find((i) => i.productId === prod.id);
    if (exists) {
      handleEditItemQty(prod.id, exists.quantity + 1);
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || '',
          barcode: prod.barcode || '',
          quantity: 1,
          returnedQuantity: 0,
          unitPrice: Number(prod.sellingPrice || 0),
          purchasePrice: Number(prod.purchasePrice || 0),
        },
      ]);
    }
    setAddProductId('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editSale) return;
    setSavingEdit(true);
    try {
      const { sale: updatedSale, stockUpdates } = await updateSale(
        editSale.id,
        {
          items: editItems,
          customerName: editCustomer,
          paidAmount: editTotals.paidAmount,
          editReason,
        },
        user
      );
      setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? updatedSale : s)));
      applyStockUpdatesLocal(stockUpdates);
      toast.success(`Invoice ${editSale.invoiceNumber} updated & stock reconciled`);
      setEditSale(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update sale');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteSale(deleteTarget.id, deleteReason, user);
      setSales((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      applyStockUpdatesLocal(res.stockUpdates);
      toast.success(`Invoice ${deleteTarget.invoiceNumber} deleted & stock restored`);
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to delete sale');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number or customer name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="recent">Recent Sales</option>
              <option value="daily">Daily Sales</option>
              <option value="monthly">Monthly Sales</option>
            </select>

            {filterMode === 'daily' && (
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => e.target.value && setDateFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            )}

            {filterMode === 'monthly' && (
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => e.target.value && setMonthFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading && sales.length === 0 ? (
          <LoadingSpinner label="Loading sales history..." />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales found"
            description="Try changing your date range or search query."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2 font-semibold">Invoice #</th>
                    <th className="px-3.5 py-2 font-semibold">Date &amp; Time</th>
                    <th className="px-3.5 py-2 font-semibold">Customer</th>
                    <th className="px-3.5 py-2 font-semibold text-center">Items</th>
                    <th className="px-3.5 py-2 font-semibold text-right">Grand Total</th>
                    <th className="px-3.5 py-2 font-semibold text-center">Payment</th>
                    <th className="px-3.5 py-2 font-semibold text-center">Returns</th>
                    <th className="px-3.5 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2 font-mono font-semibold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-3.5 py-2 text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="px-3.5 py-2 font-medium text-slate-800">
                        {sale.customerName}
                      </td>
                      <td className="px-3.5 py-2 text-center text-slate-600 font-medium">{sale.totalItems}</td>
                      <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                        {formatCurrency(sale.grandTotal, currency)}
                        {Number(sale.remainingAmount || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-normal">
                            Due: {formatCurrency(sale.remainingAmount, currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full font-semibold capitalize text-[11px] ${
                            sale.paymentStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : sale.paymentStatus === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {sale.paymentStatus || 'paid'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        {sale.returnStatus === 'full' ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-[11px]">
                            Full
                          </span>
                        ) : sale.returnStatus === 'partial' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                            Partial
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(sale)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            title="View invoice details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printReceipt(sale, 'sale')}
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Reprint thermal invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(sale)}
                            className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit sale"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(sale)}
                              className="p-1 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="Delete sale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={filteredSales.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* View Invoice Modal */}
      <Modal
        isOpen={Boolean(viewSale)}
        onClose={() => setViewSale(null)}
        title={`Invoice ${viewSale?.invoiceNumber || ''}`}
        subtitle={`Customer: ${viewSale?.customerName || ''} · ${formatDateTime(viewSale?.createdAt)}`}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setViewSale(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => viewSale && printReceipt(viewSale, 'sale')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-3.5 h-3.5" />
              Reprint {settings.paperWidth || '80mm'} Invoice
            </button>
          </>
        }
      >
        {viewSale && (
          <div className="space-y-4 text-xs">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-center">Returned</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="px-3 py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewSale.items || []).map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{item.productName}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {item.barcode || item.sku}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-red-600">
                        {item.returnedQuantity || 0}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {formatCurrency(item.unitPrice, currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(item.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(viewSale.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Grand Total</span>
                <span>{formatCurrency(viewSale.grandTotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Paid</span>
                <span>{formatCurrency(viewSale.paidAmount, currency)}</span>
              </div>
              {Number(viewSale.remainingAmount || 0) > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Remaining</span>
                  <span>{formatCurrency(viewSale.remainingAmount, currency)}</span>
                </div>
              )}
              {Number(viewSale.totalReturnedAmount || 0) > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Total Returned</span>
                  <span>-{formatCurrency(viewSale.totalReturnedAmount, currency)}</span>
                </div>
              )}
              {isManagerOrAdmin && (() => {
                if (isLocked) {
                  return (
                    <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between">
                      <span className="text-slate-500">Cost &amp; Profit</span>
                      <button
                        type="button"
                        onClick={openUnlockModal}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100"
                      >
                        <Lock className="w-3 h-3" /> Unlock Profit
                      </button>
                    </div>
                  );
                }
                const { cost, profit } = computeSaleProfit(viewSale);
                return (
                  <div className="border-t border-slate-200 pt-1.5 space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Cost</span>
                      <span>{formatCurrency(cost, currency)}</span>
                    </div>
                    <div
                      className={`flex justify-between font-bold ${
                        profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      <span>Gross Profit</span>
                      <span>{formatCurrency(profit, currency)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {loadingDetails ? (
              <LoadingSpinner label="Loading linked records..." compact />
            ) : (
              <>
                {viewReturns.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="font-semibold text-slate-800 mb-2">Linked Return Invoices</h4>
                    <div className="space-y-1.5">
                      {viewReturns.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between bg-red-50/60 border border-red-100 rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="font-mono font-semibold text-red-700">
                              {r.returnInvoiceNumber}
                            </span>
                            <span className="ml-2 text-slate-500">
                              {formatDateTime(r.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-red-700">
                              -{formatCurrency(r.totalReturnAmount, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => printReceipt(r, 'return')}
                              className="p-1 text-red-700 hover:bg-red-100 rounded"
                              title="Reprint return receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewAuditLogs.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      Audit Trail
                    </h4>
                    <ul className="space-y-1.5">
                      {viewAuditLogs.map((log) => (
                        <li
                          key={log.id}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600"
                        >
                          <span className="font-semibold text-slate-800">{log.action}</span> by{' '}
                          {log.performedBy} on {formatDateTime(log.createdAt)} — {log.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Sale Modal */}
      <Modal
        isOpen={Boolean(editSale)}
        onClose={() => !savingEdit && setEditSale(null)}
        title={`Edit Sale — ${editSale?.invoiceNumber || ''}`}
        subtitle="Inventory quantities will be restored and re-deducted atomically."
        size="lg"
        footer={
          <>
            <button
              type="button"
              disabled={savingEdit}
              onClick={() => setEditSale(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-sale-form"
              disabled={savingEdit}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingEdit ? 'Reconciling Stock...' : 'Save Sale Changes'}
            </button>
          </>
        }
      >
        <form id="edit-sale-form" onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Edit (Audit Log)
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Corrected quantity or customer name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={addProductId}
              onChange={(e) => setAddProductId(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">+ Add another product to this invoice...</option>
              {catalogProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {formatCurrency(p.sellingPrice, currency)} [Stock: {p.availableQuantity}]
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddProductToEdit}
              disabled={!addProductId}
              className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg disabled:opacity-40"
            >
              Add Item
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {editItems.map((item) => (
              <div key={item.productId} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{item.productName}</p>
                  <p className="text-slate-500">
                    Unit: {formatCurrency(item.unitPrice, currency)}
                    {item.returnedQuantity > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        (Returned: {item.returnedQuantity})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditItemQty(item.productId, item.quantity - 1)}
                    className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center hover:bg-slate-100"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={Math.max(1, Number(item.returnedQuantity || 0))}
                    value={item.quantity}
                    onChange={(e) => handleEditItemQty(item.productId, e.target.value)}
                    className="w-12 text-center py-1 border border-slate-300 rounded font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => handleEditItemQty(item.productId, item.quantity + 1)}
                    className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center hover:bg-slate-100"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-24 text-right font-semibold text-slate-900">
                  {formatCurrency(item.quantity * item.unitPrice, currency)}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveEditItem(item.productId)}
                  className="p-1 text-slate-400 hover:text-red-600"
                  title="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">
                Paid Amount ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPaid}
                onChange={(e) => setEditPaid(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
              />
            </div>
            <div className="flex flex-col justify-center text-right">
              <span className="text-slate-500">New Grand Total</span>
              <span className="text-base font-bold text-blue-700">
                {formatCurrency(editTotals.grandTotal, currency)}
              </span>
              {editTotals.remainingAmount > 0 && (
                <span className="text-[11px] text-amber-700 font-semibold">
                  Remaining: {formatCurrency(editTotals.remainingAmount, currency)}
                </span>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete Invoice ${deleteTarget?.invoiceNumber || ''}`}
        message="Deleting this sale will atomically restore all non-returned sold quantities back into product inventory and record an audit trail entry."
        confirmLabel="Delete & Restore Stock"
        loading={deleting}
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Deletion (Audit Trail)
          </label>
          <input
            type="text"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="e.g., Duplicate entry or cancelled order"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
