export default function LoadingProduct() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <div className="h-4 w-72 rounded bg-surface animate-pulse" />

      <div className="mt-5 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="aspect-[4/3] rounded-2xl border border-border bg-surface animate-pulse" />
          <div className="mt-4 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-24 rounded-full bg-surface animate-pulse" />
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <div className="h-9 w-4/5 rounded bg-surface animate-pulse" />
            <div className="mt-3 h-4 w-full rounded bg-surface animate-pulse" />
            <div className="mt-2 h-4 w-5/6 rounded bg-surface animate-pulse" />

            <div className="mt-4 h-10 w-40 rounded bg-surface animate-pulse" />

            <div className="mt-6 rounded-2xl border border-border bg-background p-4">
              <div className="h-4 w-28 rounded bg-surface animate-pulse" />
              <div className="mt-3 h-11 w-full rounded-xl bg-surface animate-pulse" />
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <div className="h-4 w-48 rounded bg-surface animate-pulse" />
              <div className="mt-3 grid gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 w-full rounded bg-surface animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-background p-6">
        <div className="h-6 w-44 rounded bg-surface animate-pulse" />
        <div className="mt-4 h-4 w-full rounded bg-surface animate-pulse" />
        <div className="mt-2 h-4 w-5/6 rounded bg-surface animate-pulse" />
        <div className="mt-2 h-4 w-2/3 rounded bg-surface animate-pulse" />
      </div>
    </div>
  );
}
