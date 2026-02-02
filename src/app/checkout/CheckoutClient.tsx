"use client";

import { useSearchParams } from "next/navigation";

export default function CheckoutClient() {
  const sp = useSearchParams();

  // esempio: ?code=... o ?coupon=...
  const code = sp.get("code");

  return (
    <div>
      <h1>Checkout</h1>
      {code ? <p>Codice: {code}</p> : null}
    </div>
  );
}
