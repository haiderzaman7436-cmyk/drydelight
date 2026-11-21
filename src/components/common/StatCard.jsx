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
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 flex items-start justify-between gap-2.5 transition-shadow hover:shadow-xs">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </p>
        <p className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate leading-tight">
            {subtitle}
          </p>
        )}
      </div>
      {Icon && (
        <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${TONE_MAP[tone] || TONE_MAP.blue}`}>
          <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      )}
    </div>
  );
}
