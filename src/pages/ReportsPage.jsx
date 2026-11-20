import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Printer } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import SummaryStatsGrid from '../components/common/SummaryStatsGrid';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getSalesByDate, getSalesByMonth, getSalesByDateRange } from '../services/salesService';
import { getReturnsByDate, getReturnsByMonth, getReturnsByDateRange } from '../services/returnService';
import { triggerBrowserReportPrint } from '../services/printService';
import { useSettings } from '../contexts/SettingsContext';
import { aggregatePeriodSummary, computeSaleProfit } from '../utils/calculations';
import { exportSalesReportPdf, exportToCsv } from '../utils/exporters';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
  roundMoney,
  shiftDateKey,
  toLocalDateKey,
  toLocalMonthKey,
} from '../utils/formatters';

export default function ReportsPage() {
  const { settings } = useSettings();
  const currency = settings.currency || 'PKR';

  const [periodMode, setPeriodMode] = useState('custom');
  const [singleDate, setSingleDate] = useState(() => toLocalDateKey(new Date()));
  const [monthKey, setMonthKey] = useState(() => toLocalMonthKey(new Date()));
  const [startDate, setStartDate] = useState(() => shiftDateKey(toLocalDateKey(new Date()), -29));
  const [endDate, setEndDate] = useState(() => toLocalDateKey(new Date()));

  const [activeTab, setActiveTab] = useState('products');
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let sData = [];
      let rData = [];

      if (periodMode === 'daily') {
        [sData, rData] = await Promise.all([
          getSalesByDate(singleDate),
          getReturnsByDate(singleDate),
        ]);
      } else if (periodMode === 'monthly') {
        [sData, rData] = await Promise.all([
          getSalesByMonth(monthKey),
          getReturnsByMonth(monthKey),
        ]);
      } else {
        const from = startDate <= endDate ? startDate : endDate;
        const to = startDate <= endDate ? endDate : startDate;
        [sData, rData] = await Promise.all([
          getSalesByDateRange(from, to),
          getReturnsByDateRange(from, to),
        ]);
      }

      setSales(sData);
      setReturns(rData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [periodMode, singleDate, monthKey, startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = useMemo(
    () => aggregatePeriodSummary({ sales, returns }),
    [sales, returns]
  );

  const periodSubtitle = useMemo(() => {
    if (periodMode === 'daily') return `Daily Report — ${formatDate(singleDate)}`;
    if (periodMode === 'monthly') return `Monthly Report — ${formatMonthLabel(monthKey)}`;
    return `Custom Range — ${formatDate(startDate)} to ${formatDate(endDate)}`;
  }, [periodMode, singleDate, monthKey, startDate, endDate]);

  const trendChartData = useMemo(() => {
    const map = new Map();
    for (const s of sales) {
      const { cost } = computeSaleProfit(s);
      const entry = map.get(s.saleDate) || {
        date: s.saleDate,
        grossSales: 0,
        grossCost: 0,
        returns: 0,
        returnCost: 0,
      };
      entry.grossSales = roundMoney(entry.grossSales + Number(s.grandTotal || 0));
      entry.grossCost = roundMoney(entry.grossCost + cost);
      map.set(s.saleDate, entry);
    }
    for (const r of returns) {
      const rCost =
        typeof r.totalReturnCost === 'number'
          ? r.totalReturnCost
          : roundMoney(
              (r.items || []).reduce(
                (sum, it) => sum + Number(it.returnQuantity || 0) * Number(it.purchasePrice || 0),
                0
              )
            );
      const entry = map.get(r.returnDate) || {
        date: r.returnDate,
        grossSales: 0,
        grossCost: 0,
        returns: 0,
        returnCost: 0,
      };
      entry.returns = roundMoney(entry.returns + Number(r.totalReturnAmount || 0));
      entry.returnCost = roundMoney(entry.returnCost + rCost);
      map.set(r.returnDate, entry);
    }
    return Array.from(map.values())
      .map((row) => {
        const netSales = roundMoney(row.grossSales - row.returns);
        const netCost = roundMoney(row.grossCost - row.returnCost);
        return {
          ...row,
          label: row.date.slice(5),
          netSales,
          netProfit: roundMoney(netSales - netCost),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales, returns]);

  const getExportTableData = () => {
    if (activeTab === 'customers') {
      return {
        tableTitle: 'Customer-Wise Sales Report',
        columns: ['Customer', 'Invoices', 'Items', 'Gross Sales', 'Returns', 'Net Sales', 'Net Profit', 'Outstanding'],
        rows: summary.customerReports.map((c) => [
          c.customerName,
          String(c.invoices),
          String(c.itemsPurchased),
          formatCurrency(c.grossAmount, currency),
          formatCurrency(c.returnAmount, currency),
          formatCurrency(c.netAmount, currency),
          formatCurrency(c.netProfit, currency),
          formatCurrency(c.outstandingAmount, currency),
        ]),
      };
    }

    if (activeTab === 'transactions') {
      return {
        tableTitle: 'Sales Invoices Ledger',
        columns: ['Invoice #', 'Date', 'Customer', 'Items', 'Grand Total', 'Profit', 'Status'],
        rows: sales.map((s) => {
          const { profit } = computeSaleProfit(s);
          return [
            s.invoiceNumber,
            s.saleDate,
            s.customerName,
            String(s.totalItems || 0),
            formatCurrency(s.grandTotal, currency),
            formatCurrency(profit, currency),
            s.paymentStatus || 'paid',
          ];
        }),
      };
    }

    const list = activeTab === 'best' ? summary.bestSellingProducts : summary.productReports;
    return {
      tableTitle: activeTab === 'best' ? 'Best-Selling Products' : 'Product-Wise Sales Report',
      columns: ['Product', 'SKU', 'Sold Qty', 'Returned Qty', 'Net Qty', 'Net Cost', 'Net Revenue', 'Net Profit'],
      rows: list.map((p) => [
        p.productName,
        p.sku || '—',
        String(p.quantitySold),
        String(p.quantityReturned),
        String(p.netQuantity),
        formatCurrency(p.netCost, currency),
        formatCurrency(p.netRevenue, currency),
        formatCurrency(p.netProfit, currency),
      ]),
    };
  };

  const handleExportCsv = () => {
    const { tableTitle, columns, rows } = getExportTableData();
    if (rows.length === 0) {
      toast.error('No report rows available to export');
      return;
    }
    exportToCsv({
      filename: `${tableTitle.toLowerCase().replace(/\s+/g, '-')}-${toLocalDateKey()}.csv`,
      headers: columns,
      rows,
    });
    toast.success('CSV report downloaded');
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { tableTitle, columns, rows } = getExportTableData();
      await exportSalesReportPdf({
        title: 'Sales & Profit Report',
        subtitle: periodSubtitle,
        businessName: settings.businessName || 'Dry Delight',
        currency,
        summary,
        tableTitle,
        columns,
        rows,
        filename: `dry-delight-report-${toLocalDateKey()}.pdf`,
      });
      toast.success('PDF report generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex bg-slate-100 rounded-lg p-1">
            {[
              { id: 'daily', label: 'Daily' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'custom', label: 'Custom Range' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPeriodMode(m.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  periodMode === m.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={exportingPdf}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              {exportingPdf ? 'Generating...' : 'Export PDF'}
            </button>
            <button
              type="button"
              onClick={triggerBrowserReportPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {periodMode === 'daily' && (
            <>
              <button
                type="button"
                onClick={() => setSingleDate((d) => shiftDateKey(d, -1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous Day
              </button>
              <button
                type="button"
                onClick={() => setSingleDate(toLocalDateKey())}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => e.target.value && setSingleDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={() => setSingleDate((d) => shiftDateKey(d, 1))}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next Day
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {periodMode === 'monthly' && (
            <input
              type="month"
              value={monthKey}
              onChange={(e) => e.target.value && setMonthKey(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            />
          )}

          {periodMode === 'custom' && (
            <>
              <label className="text-xs text-slate-500 font-medium">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => e.target.value && setStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <label className="text-xs text-slate-500 font-medium">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => e.target.value && setEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  const today = toLocalDateKey();
                  setStartDate(shiftDateKey(today, -6));
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = toLocalDateKey();
                  setStartDate(shiftDateKey(today, -29));
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                Last 30 Days
              </button>
            </>
          )}

          <span className="ml-auto text-xs font-medium text-slate-500">{periodSubtitle}</span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Compiling report data..." compact />
      ) : (
        <>
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{settings.businessName}</h2>
            <p className="text-xs text-slate-600">{periodSubtitle}</p>
          </div>

          <SummaryStatsGrid
            summary={summary}
            currency={currency}
            grossLabel="Gross Sales"
            returnsSubtitle={`${summary.totalItemsReturned} unit(s)`}
          />

          {trendChartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Sales, Profit &amp; Returns Breakdown
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val) => formatCurrency(val, currency)}
                      contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="netSales" name="Net Sales" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="returns" name="Returns" fill="#dc2626" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2 no-print">
              {[
                { id: 'products', label: `Product-Wise Sales (${summary.productReports.length})` },
                { id: 'best', label: 'Best-Selling Products' },
                { id: 'customers', label: `Customer-Wise Sales (${summary.customerReports.length})` },
                { id: 'transactions', label: `Invoices (${sales.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === t.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'products' || activeTab === 'best' ? (
              (activeTab === 'best' ? summary.bestSellingProducts : summary.productReports)
                .length === 0 ? (
                <EmptyState title="No product sales in selected period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold text-center">Sold</th>
                        <th className="px-4 py-3 font-semibold text-center">Returned</th>
                        <th className="px-4 py-3 font-semibold text-center">Net Qty</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Cost</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Revenue</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(activeTab === 'best'
                        ? summary.bestSellingProducts
                        : summary.productReports
                      ).map((p, idx) => (
                        <tr key={p.productId} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{p.productName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{p.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-center">{p.quantitySold}</td>
                          <td className="px-4 py-3 text-center text-red-600">
                            {p.quantityReturned}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {p.netQuantity}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(p.netCost, currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(p.netRevenue, currency)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              p.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(p.netProfit, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeTab === 'customers' ? (
              summary.customerReports.length === 0 ? (
                <EmptyState title="No customer sales in selected period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Customer Name</th>
                        <th className="px-4 py-3 font-semibold text-center">Invoices</th>
                        <th className="px-4 py-3 font-semibold text-center">Items</th>
                        <th className="px-4 py-3 font-semibold text-right">Gross</th>
                        <th className="px-4 py-3 font-semibold text-right">Returns</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Sales</th>
                        <th className="px-4 py-3 font-semibold text-right">Net Profit</th>
                        <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.customerReports.map((c) => (
                        <tr key={c.customerName} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {c.customerName}
                          </td>
                          <td className="px-4 py-3 text-center">{c.invoices}</td>
                          <td className="px-4 py-3 text-center">{c.itemsPurchased}</td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(c.grossAmount, currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {formatCurrency(c.returnAmount, currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {formatCurrency(c.netAmount, currency)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              c.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(c.netProfit, currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-700 font-medium">
                            {formatCurrency(c.outstandingAmount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : sales.length === 0 ? (
              <EmptyState title="No invoices in selected period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Invoice #</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold text-center">Items</th>
                      <th className="px-4 py-3 font-semibold text-right">Grand Total</th>
                      <th className="px-4 py-3 font-semibold text-right">Profit</th>
                      <th className="px-4 py-3 font-semibold text-center">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((s) => {
                      const { profit } = computeSaleProfit(s);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                            {s.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{s.saleDate}</td>
                          <td className="px-4 py-3 text-slate-800">{s.customerName}</td>
                          <td className="px-4 py-3 text-center">{s.totalItems}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(s.grandTotal, currency)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(profit, currency)}
                          </td>
                          <td className="px-4 py-3 text-center capitalize">{s.paymentStatus}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
