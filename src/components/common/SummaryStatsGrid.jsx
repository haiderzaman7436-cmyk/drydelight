import { Banknote, Receipt, Package, RotateCcw, TrendingUp, Wallet } from 'lucide-react';
import StatCard from './StatCard';
import { formatCurrency } from '../../utils/formatters';

export default function SummaryStatsGrid({
  summary,
  currency = 'PKR',
  grossLabel = 'Total Sales',
  invoicesLabel = 'Invoices',
  itemsLabel = 'Items Sold',
  netLabel = 'Net Sales',
  profitLabel = 'Net Profit',
  returnsSubtitle,
}) {
  const netProfit = Number(summary.netProfit || 0);
  const margin = Number(summary.profitMargin || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      <StatCard
        title={grossLabel}
        value={formatCurrency(summary.grossSales, currency)}
        icon={Banknote}
        tone="blue"
      />
      <StatCard
        title={invoicesLabel}
        value={summary.invoiceCount}
        icon={Receipt}
        tone="indigo"
      />
      <StatCard
        title={itemsLabel}
        value={summary.totalItemsSold}
        icon={Package}
        tone="slate"
      />
      <StatCard
        title="Returns"
        value={formatCurrency(summary.totalReturns, currency)}
        subtitle={returnsSubtitle ?? `${summary.returnCount} return(s)`}
        icon={RotateCcw}
        tone="red"
      />
      <StatCard
        title={netLabel}
        value={formatCurrency(summary.netSales, currency)}
        icon={TrendingUp}
        tone="blue"
      />
      <StatCard
        title={profitLabel}
        value={formatCurrency(netProfit, currency)}
        subtitle={`Margin: ${margin}%`}
        icon={Wallet}
        tone={netProfit >= 0 ? 'emerald' : 'red'}
      />
    </div>
  );
}
