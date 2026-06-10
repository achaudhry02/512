export function LoadingState({ label = "Loading store data..." }: { label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="h-40 animate-pulse rounded-[1.75rem] border border-white/80 bg-white/80 shadow-card"
          key={index}
        >
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </div>
  );
}
