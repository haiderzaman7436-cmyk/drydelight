import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Receipt,
  TrendingUp,
  Package,
  FolderTree,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Printer,
  ArrowRight,
  Wallet,
} from 'lucide-react';
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
import StatCard from '../components/common/StatCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useSettings } from '../contexts/SettingsContext';
import { useData } from '../contexts/DataContext';
import { usePrint } from '../contexts/PrintContext';
import { getSalesByDateRange } from '../services/salesService';
import { getReturnsByDateRange } from '../services/returnService';
import { invalidateCachePrefix } from '../services/queryCache';
import { aggregatePeriodSummary, computeSaleProfit } from '../utils/calculations';
import {
  formatCurrency,
  formatDateTime,
  formatMonthLabel,
  getLastNDaysKeys,
  getLastNMonthsKeys,
  roundMoney,
  toLocalDateKey,
  toLocalMonthKey,
} from '../utils/formatters';

export default function DashboardPage() {
  const { settings } = useSettings();
  const { products, categories, refreshCatalog } = useData();
  const { printReceipt } = usePrint();
  const currency = settings.currency || 'PKR';

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [dailyRangeDays, setDailyRangeDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [rangeSales, setRangeSales] = useState([]);
  const [rangeReturns, setRangeReturns] = useState([]);

  const loadAnalytics = useCallback(async (force = false) => {
    if (force) {
      invalidateCachePrefix('sales:');
      invalidateCachePrefix('returns:');
      refreshCatalog();
    }
    setLoading(true);
    try {
      const monthKeys = getLastNMonthsKeys(6, selectedDate);
      const startDateKey = `${monthKeys[0]}-01`;
      const todayKey = toLocalDateKey();
      const endDateKey = selectedDate > todayKey ? selectedDate : todayKey;

      const [salesData, returnsData] = await Promise.all([
        getSalesByDateRange(startDateKey, endDateKey),
        getReturnsByDateRange(startDateKey, endDateKey),
      ]);

      setRangeSales(salesData);
      setRangeReturns(returnsData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, refreshCatalog]);

  useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  const selectedMonthKey = useMemo(() => toLocalMonthKey(selectedDate), [selectedDate]);

  // Derive recent sales directly from already-fetched rangeSales (zero extra query)
  const recentSales = useMemo(() => rangeSales.slice(0, 8), [rangeSales]);

  const daySummary = useMemo(() => {
    const daySales = rangeSales.filter((s) => s.saleDate === selectedDate);
    const dayReturns = rangeReturns.filter((r) => r.returnDate === selectedDate);
    return aggregatePeriodSummary({ sales: daySales, returns: dayReturns });
  }, [rangeSales, rangeReturns, selectedDate]);

  const monthSummary = useMemo(() => {
    const monthSales = rangeSales.filter((s) => s.saleMonth === selectedMonthKey);
    const monthReturns = rangeReturns.filter((r) => r.returnMonth === selectedMonthKey);
    return aggregatePeriodSummary({ sales: monthSales, returns: monthReturns });
  }, [rangeSales, rangeReturns, selectedMonthKey]);

  const { lowStockProducts, totalUnitsInStock, outOfStockCount } = useMemo(() => {
    let units = 0;
    let outCount = 0;
    const low = [];
    for (const p of products) {
      const qty = Number(p.availableQuantity || 0);
      units += qty;
      if (qty === 0) outCount += 1;
      if (qty <= Number(p.minStockLevel || 0)) low.push(p);
    }
    low.sort((a, b) => Number(a.availableQuantity || 0) - Number(b.availableQuantity || 0));
    return { lowStockProducts: low, totalUnitsInStock: units, outOfStockCount: outCount };
  }, [products]);

  const dailyChartData = useMemo(() => {
    const keys = getLastNDaysKeys(dailyRangeDays, selectedDate);
    const salesByDay = new Map();
    const costByDay = new Map();
    const returnsByDay = new Map();
    const returnCostByDay = new Map();

    for (const s of rangeSales) {
      const { cost } = computeSaleProfit(s);
      salesByDay.set(s.saleDate, roundMoney((salesByDay.get(s.saleDate) || 0) + Number(s.grandTotal || 0)));
      costByDay.set(s.saleDate, roundMoney((costByDay.get(s.saleDate) || 0) + cost));
    }
    for (const r of rangeReturns) {
      const rCost =
        typeof r.totalReturnCost === 'number'
          ? r.totalReturnCost
          : roundMoney(
              (r.items || []).reduce(
                (sum, it) => sum + Number(it.returnQuantity || 0) * Number(it.purchasePrice || 0),
                0
              )
            );
      returnsByDay.set(
        r.returnDate,
        roundMoney((returnsByDay.get(r.returnDate) || 0) + Number(r.totalReturnAmount || 0))
      );
      returnCostByDay.set(
        r.returnDate,
        roundMoney((returnCostByDay.get(r.returnDate) || 0) + rCost)
      );
    }

    return keys.map((key) => {
      const netSales = roundMoney((salesByDay.get(key) || 0) - (returnsByDay.get(key) || 0));
      const netCost = roundMoney((costByDay.get(key) || 0) - (returnCostByDay.get(key) || 0));
      return {
        label: key.slice(5),
        date: key,
        netSales,
        netProfit: roundMoney(netSales - netCost),
      };
    });
  }, [rangeSales, rangeReturns, dailyRangeDays, selectedDate]);

  const monthlyChartData = useMemo(() => {
    const keys = getLastNMonthsKeys(6, selectedDate);
    const salesByMonth = new Map();
    const costByMonth = new Map();
    const returnsByMonth = new Map();
    const returnCostByMonth = new Map();

    for (const s of rangeSales) {
      const { cost } = computeSaleProfit(s);
      salesByMonth.set(
        s.saleMonth,
        roundMoney((salesByMonth.get(s.saleMonth) || 0) + Number(s.grandTotal || 0))
      );
      costByMonth.set(s.saleMonth, roundMoney((costByMonth.get(s.saleMonth) || 0) + cost));
    }
    for (const r of rangeReturns) {
      const rCost =
        typeof r.totalReturnCost === 'number'
          ? r.totalReturnCost
          : roundMoney(
              (r.items || []).reduce(
                (sum, it) => sum + Number(it.returnQuantity || 0) * Number(it.purchasePrice || 0),
                0
              )
            );
      returnsByMonth.set(
        r.returnMonth,
        roundMoney((returnsByMonth.get(r.returnMonth) || 0) + Number(r.totalReturnAmount || 0))
      );
      returnCostByMonth.set(
        r.returnMonth,
        roundMoney((returnCostByMonth.get(r.returnMonth) || 0) + rCost)
      );
    }

    return keys.map((key) => {
      const netSales = roundMoney((salesByMonth.get(key) || 0) - (returnsByMonth.get(key) || 0));
      const netCost = roundMoney((costByMonth.get(key) || 0) - (returnCostByMonth.get(key) || 0));
      return {
        label: formatMonthLabel(key).slice(0, 3),
        month: formatMonthLabel(key),
        netSales,
        netProfit: roundMoney(netSales - netCost),
      };
    });
  }, [rangeSales, rangeReturns, selectedDate]);

  if (loading && rangeSales.length === 0) {
    return <LoadingSpinner label="Loading business metrics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Business Overview</h2>
          <p className="text-xs text-slate-500">
            Live Firestore figures for {selectedDate} &amp; {formatMonthLabel(selectedMonthKey)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700"
          />
          <select
            value={dailyRangeDays}
            onChange={(e) => setDailyRangeDays(Number(e.target.value))}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateKey())}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => loadAnalytics(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards including Today's & Monthly Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(daySummary.netSales, currency)}
          subtitle={
            daySummary.totalReturns > 0
              ? `Gross ${formatCurrency(daySummary.grossSales, currency)}`
              : `${daySummary.totalItemsSold} items sold`
          }
          icon={Banknote}
          tone="blue"
        />
        <StatCard
          title="Today's Profit"
          value={formatCurrency(daySummary.netProfit, currency)}
          subtitle={`Margin: ${daySummary.profitMargin}% · Cost: ${formatCurrency(daySummary.netCost, currency)}`}
          icon={Wallet}
          tone={daySummary.netProfit >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          title="Today's Transactions"
          value={daySummary.invoiceCount}
          subtitle={`${daySummary.totalItemsSold} total units`}
          icon={Receipt}
          tone="indigo"
        />
        <StatCard
          title="Monthly Sales"
          value={formatCurrency(monthSummary.netSales, currency)}
          subtitle={`${monthSummary.invoiceCount} invoices in ${formatMonthLabel(selectedMonthKey)}`}
          icon={TrendingUp}
          tone="blue"
        />
        <StatCard
          title="Monthly Profit"
          value={formatCurrency(monthSummary.netProfit, currency)}
          subtitle={`Margin: ${monthSummary.profitMargin}% · Cost: ${formatCurrency(monthSummary.netCost, currency)}`}
          icon={Wallet}
          tone={monthSummary.netProfit >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          title="Total Returns (Month)"
          value={formatCurrency(monthSummary.totalReturns, currency)}
          subtitle={`Today: ${formatCurrency(daySummary.totalReturns, currency)} (${daySummary.returnCount})`}
          icon={RotateCcw}
          tone="red"
        />
        <StatCard
          title="Total Products"
          value={products.length}
          subtitle={`${totalUnitsInStock} units in stock`}
          icon={Package}
          tone="slate"
        />
        <StatCard
          title="Total Categories"
          value={categories.length}
          subtitle="Active product groups"
          icon={FolderTree}
          tone="blue"
        />
        <StatCard
          title="Low Stock Products"
          value={lowStockProducts.length}
          subtitle={`${outOfStockCount} out of stock`}
          icon={AlertTriangle}
          tone={lowStockProducts.length > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Daily Net Sales &amp; Profit</h3>
            <p className="text-xs text-slate-500">Last {dailyRangeDays} days ending {selectedDate}</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value, currency)}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.date || l}
                  contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="netSales" name="Net Sales" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Monthly Sales &amp; Profit Trend</h3>
            <p className="text-xs text-slate-500">Last 6 months net revenue &amp; profit</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value, currency)}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.month || l}
                  contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="netSales" name="Net Sales" fill="#0f172a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Sales Transactions</h3>
            <Link
              to="/sales"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <EmptyState
              title="No sales recorded yet"
              description="Complete a checkout in the POS module to see transactions here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{sale.customerName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(sale.grandTotal, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => printReceipt(sale, 'sale')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                          title="Reprint thermal invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Top-Selling Products</h3>
              <span className="text-[11px] text-slate-400">
                {formatMonthLabel(selectedMonthKey)}
              </span>
            </div>
            {monthSummary.bestSellingProducts.length === 0 ? (
              <EmptyState title="No sales this month" description="Top products will appear once sales are recorded." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {monthSummary.bestSellingProducts.slice(0, 5).map((item, idx) => (
                  <li key={item.productId} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.netQuantity} net units sold
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-900 shrink-0">
                      {formatCurrency(item.netRevenue, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Low-Stock Alerts</h3>
              <Link
                to="/inventory"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Manage
              </Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="p-5 text-xs text-emerald-700 bg-emerald-50/40 text-center font-medium">
                All products are above minimum stock levels.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {lowStockProducts.slice(0, 8).map((prod) => (
                  <li key={prod.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        SKU: {prod.sku} · Min: {prod.minStockLevel}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                        Number(prod.availableQuantity || 0) === 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {prod.availableQuantity} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
