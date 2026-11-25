import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Printer, Lock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';
import SummaryStatsGrid from '../components/common/SummaryStatsGrid';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getSalesByDate, getSalesByMonth } from '../services/salesService';
import { getReturnsByDate, getReturnsByMonth } from '../services/returnService';
import { useSettings } from '../contexts/SettingsContext';
import { useProfitLock } from '../contexts/ProfitLockContext';
import { usePrint } from '../contexts/PrintContext';
import { aggregatePeriodSummary } from '../utils/calculations';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonthLabel,
  shiftDateKey,
  toLocalDateKey,
  toLocalMonthKey,
} from '../utils/formatters';

export default function SalesSummaryPage() {
  const { settings } = useSettings();
  const { lockEnabled, isLocked, openUnlockModal, lockNow } = useProfitLock();
  const { printReceipt } = usePrint();
  const currency = settings.currency || 'PKR';

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [loading, setLoading] = useState(true);

  const [daySales, setDaySales] = useState([]);
  const [dayReturns, setDayReturns] = useState([]);
  const [monthSales, setMonthSales] = useState([]);
  const [monthReturns, setMonthReturns] = useState([]);

  const selectedMonth = useMemo(() => toLocalMonthKey(selectedDate), [selectedDate]);
  const todayKey = toLocalDateKey(new Date());

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [dSales, dReturns, mSales, mReturns] = await Promise.all([
        getSalesByDate(selectedDate),
        getReturnsByDate(selectedDate),
        getSalesByMonth(selectedMonth),
        getReturnsByMonth(selectedMonth),
      ]);
      setDaySales(dSales);
      setDayReturns(dReturns);
      setMonthSales(mSales);
      setMonthReturns(mReturns);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sales summary');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedMonth]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const dailySummary = useMemo(
    () => aggregatePeriodSummary({ sales: daySales, returns: dayReturns }),
    [daySales, dayReturns]
  );

  const monthlySummary = useMemo(
    () => aggregatePeriodSummary({ sales: monthSales, returns: monthReturns }),
    [monthSales, monthReturns]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            {formatDate(selectedDate)}
            {selectedDate === todayKey && (
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700">
                Today
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Navigate between days to inspect daily and monthly figures without modifying any records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDateKey(prev, -1))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Day
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateKey(new Date()))}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              selectedDate === todayKey
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Today
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            aria-label="Select summary date"
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800"
          />

          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDateKey(prev, 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
          >
            Next Day
            <ChevronRight className="w-4 h-4" />
          </button>

          {lockEnabled && (
            <button
              type="button"
              onClick={isLocked ? openUnlockModal : lockNow}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                isLocked
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isLocked ? 'Unlock Profit' : 'Lock Profit'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label={`Calculating summary for ${selectedDate}...`} compact />
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Daily Summary — {formatDate(selectedDate)}
            </h3>
            <SummaryStatsGrid summary={dailySummary} currency={currency} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Monthly Summary — {formatMonthLabel(selectedMonth)}
            </h3>
            <SummaryStatsGrid
              summary={monthlySummary}
              currency={currency}
              grossLabel="Monthly Gross"
              invoicesLabel="Transactions"
              itemsLabel="Products Sold"
              netLabel="Monthly Net"
              profitLabel="Monthly Profit"
            />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                  Invoices on {formatDate(selectedDate)}
                </h3>
                <span className="text-[11px] text-slate-500">{daySales.length} invoice(s)</span>
              </div>
              {daySales.length === 0 ? (
                <EmptyState
                  title="No invoices on this date"
                  description="Use Previous Day or Next Day to inspect another day."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-2 font-semibold">Invoice #</th>
                        <th className="px-3.5 py-2 font-semibold">Customer</th>
                        <th className="px-3.5 py-2 font-semibold">Time</th>
                        <th className="px-3.5 py-2 font-semibold text-right">Total</th>
                        <th className="px-3.5 py-2 font-semibold text-right">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {daySales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3.5 py-2 font-mono font-semibold text-slate-900">
                            {s.invoiceNumber}
                          </td>
                          <td className="px-3.5 py-2 text-slate-700">{s.customerName}</td>
                          <td className="px-3.5 py-2 text-slate-500 text-[11px]">
                            {formatDateTime(s.createdAt)}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                            {formatCurrency(s.grandTotal, currency)}
                          </td>
                          <td className="px-3.5 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => printReceipt(s, 'sale')}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                              title="Reprint invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                  Products Sold on {formatDate(selectedDate)}
                </h3>
                <span className="text-xs text-slate-500">
                  {dailySummary.productReports.length} product(s)
                </span>
              </div>
              {dailySummary.productReports.length === 0 ? (
                <EmptyState
                  title="No products sold on this date"
                  description="Product quantities sold and returned on this day will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold text-center">Sold</th>
                        <th className="px-4 py-3 font-semibold text-center">Returned</th>
                        <th className="px-4 py-3 font-semibold text-center">Net Qty</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Revenue</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailySummary.productReports.map((p) => (
                        <tr key={p.productId} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-900">{p.productName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{p.sku}</p>
                          </td>
                          <td className="px-4 py-2.5 text-center text-slate-700">
                            {p.quantitySold}
                          </td>
                          <td className="px-4 py-2.5 text-center text-red-600">
                            {p.quantityReturned}
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-slate-900">
                            {p.netQuantity}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                            {formatCurrency(p.netRevenue, currency)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold ${
                              isLocked
                                ? 'text-slate-400'
                                : p.netProfit >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                            }`}
                          >
                            {isLocked ? (
                              <button
                                type="button"
                                onClick={openUnlockModal}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline"
                                title="Click to unlock profit"
                              >
                                <Lock className="w-3 h-3" /> ••••
                              </button>
                            ) : (
                              formatCurrency(p.netProfit, currency)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
