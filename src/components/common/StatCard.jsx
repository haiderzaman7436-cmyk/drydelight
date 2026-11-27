import { Lock } from 'lucide-react';

const GRADIENT_MAP = {
  blue: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white',
  emerald: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
  red: 'bg-gradient-to-br from-rose-600 to-red-700 text-white',
  indigo: 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white',
  purple: 'bg-gradient-to-br from-violet-600 to-purple-700 text-white',
  slate: 'bg-gradient-to-br from-[#0f2347] to-[#1e3a6e] text-white',
  locked: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
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
  const cardGradient = locked
    ? GRADIENT_MAP.locked
    : GRADIENT_MAP[tone] || GRADIENT_MAP.blue;
  const isInteractive = Boolean(onClick);

  const content = (
    <div className="flex items-center gap-3 w-full min-w-0">
      {DisplayIcon && (
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <DisplayIcon className="w-5 h-5 text-white" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-base sm:text-lg font-bold tracking-tight text-white truncate leading-tight">
          {locked ? 'Protected' : value}
        </p>
        <p className="text-[11px] font-medium text-white/90 truncate flex items-center gap-1.5 mt-0.5">
          <span className="truncate">{title}</span>
          {locked && (
            <span className="px-1.5 py-0.2 rounded bg-white/25 text-white text-[9px] font-bold tracking-normal">
              LOCKED
            </span>
          )}
        </p>
        {(locked || subtitle) && (
          <p className="text-[10px] sm:text-[11px] text-white/80 mt-0.5 truncate leading-tight">
            {locked ? 'Click to unlock with PIN' : subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-xl p-3 sm:p-3.5 shadow-sm transition-all hover:brightness-105 cursor-pointer ${cardGradient}`}
        title="Click to unlock profit view"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`rounded-xl p-3 sm:p-3.5 shadow-sm ${cardGradient}`}>
      {content}
    </div>
  );
}
