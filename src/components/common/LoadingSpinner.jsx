export default function LoadingSpinner({ label = 'Loading...', compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        compact ? 'py-6' : 'py-14'
      } text-slate-500`}
    >
      <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      {label && <span className="text-xs font-medium mt-2.5">{label}</span>}
    </div>
  );
}
