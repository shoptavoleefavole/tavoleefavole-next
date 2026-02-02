import { Suspense } from "react";
import RegistratiClient from "./RegistratiClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento...</div>}>
      <RegistratiClient />
    </Suspense>
  );
}
