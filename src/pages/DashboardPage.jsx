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
  Lock,
  Unlock,
  ShoppingCart,
  Boxes,
  BarChart3,
  Star,
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
import { useProfitLock } from '../contexts/ProfitLockContext';
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
import { getProductImage } from '../utils/productImages';

export default function DashboardPage() {
  const { settings } = useSettings();
  const { lockEnabled, isLocked, openUnlockModal, lockNow } = useProfitLock();
  const { products, categories, productById, refreshCatalog } = useData();
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
    <div className="space-y-3.5 sm:space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[#0f2347]">Welcome Back!</h2>
          <p className="text-[11px] text-slate-500">
            Your Shop Overview · {selectedDate} &amp; {formatMonthLabel(selectedMonthKey)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700"
          />
          <select
            value={dailyRangeDays}
            onChange={(e) => setDailyRangeDays(Number(e.target.value))}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateKey())}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => loadAnalytics(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {lockEnabled && (
            <button
              type="button"
              onClick={isLocked ? openUnlockModal : lockNow}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                isLocked
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
              title={isLocked ? 'Unlock Today & Monthly Profit' : 'Lock Today & Monthly Profit'}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isLocked ? 'Unlock Profit' : 'Lock Profit'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards including Today's & Monthly Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
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
          locked={isLocked}
          onClick={isLocked ? openUnlockModal : undefined}
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
          tone="amber"
        />
        <StatCard
          title="Monthly Profit"
          value={formatCurrency(monthSummary.netProfit, currency)}
          subtitle={`Margin: ${monthSummary.profitMargin}% · Cost: ${formatCurrency(monthSummary.netCost, currency)}`}
          icon={Wallet}
          tone={monthSummary.netProfit >= 0 ? 'emerald' : 'red'}
          locked={isLocked}
          onClick={isLocked ? openUnlockModal : undefined}
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
          tone="purple"
        />
      </div>

      {/* Quick Actions Grid (example layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Link
          to="/products"
          className="group bg-white border border-slate-200/90 hover:border-blue-400 rounded-xl p-3 flex flex-col items-center text-center gap-1.5 shadow-2xs hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0f2347]">Add Product</p>
          <p className="text-[11px] text-slate-500">Catalog &amp; Photos</p>
          <span className="mt-0.5 w-8 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/pos"
          className="group bg-white border border-slate-200/90 hover:border-blue-400 rounded-xl p-3 flex flex-col items-center text-center gap-1.5 shadow-2xs hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0f2347]">New Sale</p>
          <p className="text-[11px] text-slate-500">Sell Products (POS)</p>
          <span className="mt-0.5 w-8 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/inventory"
          className="group bg-white border border-slate-200/90 hover:border-blue-400 rounded-xl p-3 flex flex-col items-center text-center gap-1.5 shadow-2xs hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0f2347]">Inventory Stock</p>
          <p className="text-[11px] text-slate-500">Stock &amp; Alerts</p>
          <span className="mt-0.5 w-8 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/reports"
          className="group bg-white border border-slate-200/90 hover:border-blue-400 rounded-xl p-3 flex flex-col items-center text-center gap-1.5 shadow-2xs hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0f2347]">View Reports</p>
          <p className="text-[11px] text-slate-500">Sales &amp; Profit Reports</p>
          <span className="mt-0.5 w-8 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                {isLocked ? 'Daily Net Sales' : 'Daily Net Sales & Profit'}
              </h3>
              <p className="text-[11px] text-slate-500">Last {dailyRangeDays} days ending {selectedDate}</p>
            </div>
            {isLocked && (
              <button
                type="button"
                onClick={openUnlockModal}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100"
              >
                <Lock className="w-3 h-3" /> Profit locked
              </button>
            )}
          </div>
          <div className="h-56 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value, currency)}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.date || l}
                  contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="netSales" name="Net Sales" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                {!isLocked && (
                  <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                {isLocked ? 'Monthly Sales Trend' : 'Monthly Sales & Profit Trend'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isLocked ? 'Last 6 months net revenue' : 'Last 6 months net revenue & profit'}
              </p>
            </div>
            {isLocked && (
              <button
                type="button"
                onClick={openUnlockModal}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100"
              >
                <Lock className="w-3 h-3" /> Profit locked
              </button>
            )}
          </div>
          <div className="h-56 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value, currency)}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.month || l}
                  contentStyle={{ borderRadius: '8px', borderColor: '#e2e8f0', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="netSales" name="Net Sales" fill="#0f172a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                {!isLocked && (
                  <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs">
          <div className="px-4 py-3 bg-[#0f2347] text-white flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold">Recent Sales Transactions</h3>
            <Link
              to="/sales"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-blue-200 hover:text-white"
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
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2 font-semibold">Invoice</th>
                    <th className="px-3.5 py-2 font-semibold">Customer</th>
                    <th className="px-3.5 py-2 font-semibold">Date</th>
                    <th className="px-3.5 py-2 font-semibold text-right">Total</th>
                    <th className="px-3.5 py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2 font-mono font-semibold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-3.5 py-2 text-slate-700">{sale.customerName}</td>
                      <td className="px-3.5 py-2 text-slate-500 text-[11px]">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="px-3.5 py-2 text-right font-semibold text-slate-900">
                        {formatCurrency(sale.grandTotal, currency)}
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => printReceipt(sale, 'sale')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-xs"
                          title="Reprint thermal invoice"
                        >
                          <Printer className="w-3 h-3" />
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

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#0f2347] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h3 className="text-sm font-semibold">Top Selling Products</h3>
              </div>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-200 hover:text-white"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {monthSummary.bestSellingProducts.length === 0 ? (
              <EmptyState title="No sales this month" description="Top products will appear once sales are recorded." />
            ) : (
              <div className="p-3 grid grid-cols-3 gap-2.5">
                {monthSummary.bestSellingProducts.slice(0, 3).map((item) => {
                  const catalogProd = productById?.get(item.productId);
                  const imageSrc = getProductImage(
                    catalogProd || { name: item.productName }
                  );
                  return (
                    <div
                      key={item.productId}
                      className="rounded-xl border border-slate-100 bg-slate-50/40 p-2 text-center flex flex-col items-center justify-between gap-1.5"
                    >
                      <div className="w-16 h-16 rounded-lg bg-white border border-slate-200/80 p-1 flex items-center justify-center overflow-hidden">
                        <img
                          src={imageSrc}
                          alt={item.productName}
                          loading="lazy"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="w-full min-w-0">
                        <p className="text-[11px] font-bold text-[#0f2347] line-clamp-2 leading-tight">
                          {item.productName}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                          {item.netQuantity} pcs
                        </p>
                        <p className="text-[10px] font-bold text-emerald-700">
                          {formatCurrency(item.netRevenue, currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#0f2347] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Stock Alerts</h3>
              </div>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-200 hover:text-white"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="p-5 text-xs text-emerald-700 bg-emerald-50/40 text-center font-medium">
                All products are above minimum stock levels.
              </div>
            ) : (
              <div className="p-2.5 space-y-2 max-h-64 overflow-y-auto">
                {lowStockProducts.slice(0, 6).map((prod) => {
                  const qty = Number(prod.availableQuantity || 0);
                  const isOut = qty === 0;
                  return (
                    <div
                      key={prod.id}
                      className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2.5 ${
                        isOut ? 'bg-red-50/80 border-red-200' : 'bg-rose-50/70 border-rose-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getProductImage(prod)}
                          alt={prod.name}
                          loading="lazy"
                          className="w-9 h-9 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0f2347] truncate">
                            {prod.name}
                          </p>
                          <p className="text-[11px] font-semibold text-rose-600">
                            {isOut ? 'Out of stock' : `Only ${qty} left`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0 ${
                          isOut ? 'bg-red-600' : 'bg-rose-600'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
