export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-surface-2/70" />
        <div className="mt-4 h-4 w-96 rounded-xl bg-surface-2/70" />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background p-5">
              <div className="h-12 w-12 rounded-2xl bg-surface-2/70" />
              <div className="mt-4 h-4 w-40 rounded-xl bg-surface-2/70" />
              <div className="mt-2 h-4 w-28 rounded-xl bg-surface-2/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
