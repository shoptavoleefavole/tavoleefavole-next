"use client";

import { useFavorites } from "./FavoritesProvider";

export default function FavoriteToggleButton(props: {
  productId: string | number;
  className?: string;
}) {
  const { productId, className } = props;
  const { ready, loggedIn, isFavorite, toggle, isBusy } = useFavorites();

  const key = String(productId);
  const fav = isFavorite(key);
  const busy = isBusy(key);

  async function onClick() {
    if (!ready) return;

    if (!loggedIn) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/accedi?next=${next}`;
      return;
    }

    await toggle(key);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready || busy}
      aria-label={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
      aria-pressed={fav}
      className={[
        "h-10 w-10 rounded-full border border-border bg-background/90 backdrop-blur",
        "grid place-items-center text-lg font-extrabold",
        "hover:bg-surface-2 transition",
        (!ready || busy) ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
        fav ? "text-red-600" : "text-neutral-700",
        className ?? "",
      ].join(" ")}
      title={fav ? "Nei preferiti" : "Aggiungi ai preferiti"}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
