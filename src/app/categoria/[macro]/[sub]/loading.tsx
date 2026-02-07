export default function LoadingMacroSub() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="h-4 w-64 rounded bg-surface animate-pulse" />
      <div className="mt-4 h-8 w-[420px] rounded bg-surface animate-pulse" />
      <div className="mt-2 h-4 w-72 rounded bg-surface animate-pulse" />

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
