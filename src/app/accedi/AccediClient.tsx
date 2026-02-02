"use client";

import { useSearchParams } from "next/navigation";

export default function AccediClient() {
  const sp = useSearchParams();

  // esempi comuni: ?redirect=/account oppure ?error=...
  const redirect = sp.get("redirect");
  const error = sp.get("error");

  return (
    <div>
      <h1>Accedi</h1>
      {error ? <p className="text-red-600">Errore: {error}</p> : null}
      {redirect ? <p>Dopo login vai a: {redirect}</p> : null}
    </div>
  );
}
