export default function StockBadge({ quantity, minStockLevel = 0, compact = false }) {
  const qty = Number(quantity || 0);
  const min = Number(minStockLevel || 0);
  const isOut = qty <= 0;
  const isLow = qty > 0 && qty <= min;

  const tone = isOut
    ? 'bg-red-100 text-red-700'
    : isLow
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-50 text-emerald-700';

  const label = compact ? (isOut ? 'Out' : `${qty} in stock`) : String(qty);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
        compact ? 'text-[10px]' : 'text-xs'
      } ${tone}`}
    >
      {label}
    </span>
  );
}
