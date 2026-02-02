import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento...</div>}>
      <CheckoutClient />
    </Suspense>
  );
}
