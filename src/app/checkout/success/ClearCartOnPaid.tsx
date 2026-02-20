// src/app/checkout/success/clearcartonpaid.ts
const STORAGE_KEY = "tf_cart_v2";

export function clearCartOnPaid(opts: {
  sessionId: string;
  clearProvider?: () => void;
}) {
  const { sessionId, clearProvider } = opts;

  // evita doppie esecuzioni (StrictMode / refresh)
  const guardKey = `tf_cart_cleared_once:${sessionId || "no_session"}`;

  try {
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem(guardKey) === "1") return;
    sessionStorage.setItem(guardKey, "1");

    // 1) clear dello stato in memoria (CartProvider) se disponibile
    try {
      clearProvider?.();
    } catch {}

    // 2) clear localStorage (chiavi note)
    const keysToClear = [STORAGE_KEY, "cart", "tavoleefavole_cart"];
    for (const k of keysToClear) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // 3) eventi per aggiornare eventuali listener
    try {
      window.dispatchEvent(new CustomEvent("tf_cart:clear", { detail: { keys: keysToClear } }));
    } catch {}

    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: null, oldValue: null })
      );
    } catch {
      try {
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    // NIENTE reload automatico: è la causa #1 di UI “strane” e loop
  } catch {
    // best effort: non facciamo reload per non rompere UX
  }
}