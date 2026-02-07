export default function LoadingCatalogo() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="h-4 w-48 rounded bg-surface animate-pulse" />

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="h-8 w-56 rounded bg-surface animate-pulse" />
          <div className="mt-2 h-4 w-80 rounded bg-surface animate-pulse" />
        </div>
        <div className="h-4 w-28 rounded bg-surface animate-pulse" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background p-4">
        <div className="h-11 w-full rounded-xl bg-surface animate-pulse" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-background p-3">
            <div className="aspect-[4/3] rounded-xl bg-surface animate-pulse" />
            <div className="mt-3 h-4 w-4/5 rounded bg-surface animate-pulse" />
            <div className="mt-2 h-4 w-2/5 rounded bg-surface animate-pulse" />
            <div className="mt-3 h-10 w-full rounded-xl bg-surface animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
