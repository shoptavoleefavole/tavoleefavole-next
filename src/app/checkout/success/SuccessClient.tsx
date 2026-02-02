"use client";

import { useSearchParams } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id"); // oppure quello che usi tu

  return (
    <div>
      <h1>Pagamento completato</h1>
      {sessionId ? <p>Session: {sessionId}</p> : null}
    </div>
  );
}
