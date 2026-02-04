"use client";

import dynamic from "next/dynamic";

const DebugCartPanel = dynamic(() => import("@/components/DebugCartPanel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-border bg-background p-5 text-sm text-muted-text">
      Caricamento pannello debug...
    </div>
  ),
});

export default function DebugCartPanelClient() {
  return <DebugCartPanel />;
}
