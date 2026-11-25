import { Lock } from 'lucide-react';

const TONE_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'blue',
  locked = false,
  onClick,
}) {
  const DisplayIcon = locked ? Lock : Icon;
  const effectiveTone = locked ? 'amber' : tone;
  const isInteractive = Boolean(onClick);

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate flex items-center gap-1.5">
          <span className="truncate">{title}</span>
          {locked && (
            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold tracking-normal">
              LOCKED
            </span>
          )}
        </p>
        <p
          className={`text-lg sm:text-xl font-bold mt-0.5 tracking-tight truncate ${
            locked ? 'text-slate-400 select-none' : 'text-slate-900'
          }`}
        >
          {locked ? 'Protected' : value}
        </p>
        {(locked || subtitle) && (
          <p
            className={`text-[11px] sm:text-xs mt-0.5 truncate leading-tight ${
              locked ? 'text-amber-700 font-medium' : 'text-slate-500'
            }`}
          >
            {locked ? 'Click to unlock with PIN' : subtitle}
          </p>
        )}
      </div>
      {DisplayIcon && (
        <div
          className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${
            TONE_MAP[effectiveTone] || TONE_MAP.blue
          }`}
        >
          <DisplayIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-white rounded-xl border border-amber-300/90 hover:border-amber-400 hover:bg-amber-50/30 p-3 sm:p-3.5 flex items-start justify-between gap-2.5 transition-all shadow-xs cursor-pointer"
        title="Click to unlock profit view"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 flex items-start justify-between gap-2.5 transition-shadow hover:shadow-xs">
      {content}
    </div>
  );
}
