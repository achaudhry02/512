export function LoadingState({ label = "Loading store data..." }: { label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white/80"
          key={index}
        >
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </div>
  );
}
