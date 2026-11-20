const TONE_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

export default function StatCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
          {title}
        </p>
        <p className="text-xl font-bold text-slate-900 mt-1.5 tracking-tight truncate">
          {value}
        </p>
        {subtitle && <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>}
      </div>
      {Icon && (
        <div className={`p-2.5 rounded-lg shrink-0 ${TONE_MAP[tone] || TONE_MAP.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
