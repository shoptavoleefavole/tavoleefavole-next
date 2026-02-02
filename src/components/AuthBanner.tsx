"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MeResponse =
  | { loggedIn: false }
  | { loggedIn: true; user: any };

export default function AuthBanner() {
  const [state, setState] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ loggedIn: false }));
  }, []);

  if (!state) return null;

  // NON LOGGATO
  if (!state.loggedIn) {
    return (
      <div
        style={{
          background: "#f8f9fa",
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Accedi al tuo account personale
        </div>
        <div style={{ marginBottom: 12 }}>
          per scoprire le offerte dedicate a te
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/accedi">
            <button style={buttonStyle}>Accedi</button>
          </Link>
          <Link href="/registrati">
            <button style={secondaryButtonStyle}>Registrati</button>
          </Link>
        </div>
      </div>
    );
  }

  // LOGGATO
  return (
    <div
      style={{
        background: "#eaf7ef",
        border: "1px solid #d1e7dd",
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Bentornato, {state.user.username}
      </div>
      <Link href="/account">
        👉 Vai alle <strong>offerte riservate</strong>
      </Link>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#fff",
  border: "1px solid #ddd",
};
