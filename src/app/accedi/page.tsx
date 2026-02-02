import { Suspense } from "react";
import AccediClient from "./AccediClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento...</div>}>
      <AccediClient />
    </Suspense>
  );
}
