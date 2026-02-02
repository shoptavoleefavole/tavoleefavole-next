"use client";

import { useSearchParams } from "next/navigation";

export default function RegistratiClient() {
  const sp = useSearchParams();

  // esempio: se usi ?redirect=/account
  const redirect = sp.get("redirect");

  return (
    <div>
      <h1>Registrati</h1>
      {redirect ? <p>Redirect dopo registrazione: {redirect}</p> : null}
    </div>
  );
}
