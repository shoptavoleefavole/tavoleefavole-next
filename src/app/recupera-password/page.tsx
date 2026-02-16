import { Suspense } from "react";
import RecuperaPasswordClient from "./RecuperaPasswordClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento...</div>}>
      <RecuperaPasswordClient />
    </Suspense>
  );
}
