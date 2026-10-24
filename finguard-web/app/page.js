"use client";
import dynamic from "next/dynamic";

// Firebase runs in the browser only, so skip server rendering for the app.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <p className="p-8 text-muted">Loading FinGuard AI…</p>,
});

export default function Page() {
  return <App />;
}
