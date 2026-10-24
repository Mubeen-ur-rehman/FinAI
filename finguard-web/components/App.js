"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { API_URL } from "@/lib/scoring";
import Login from "./Login";
import Dashboard from "./Dashboard";
import UploadPanel from "./UploadPanel";
import AlertsTable from "./AlertsTable";
import PathMap from "./PathMap";
import { btnGhost } from "./ui";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "upload", label: "Upload" },
  { id: "alerts", label: "Alerts" },
  { id: "paths", label: "Path map" },
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [role, setRole] = useState("analyst");
  const [tab, setTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [focusAccount, setFocusAccount] = useState("");
  const [dataError, setDataError] = useState("");

  // 1) Auth state + user profile (role)
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return;
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setRole(snap.data().role);
        else await setDoc(ref, { email: u.email, role: "analyst" });
      } catch (e) {
        setDataError(e.message);
      }
    });
  }, []);

  // 2) Live data from Firestore
  useEffect(() => {
    if (!user) return;
    const onErr = (e) => setDataError(e.message);
    const unsubA = onSnapshot(
      query(collection(db, "alerts"), orderBy("risk_score", "desc"), limit(500)),
      (s) => setAlerts(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    const unsubB = onSnapshot(
      query(collection(db, "batches"), orderBy("createdAt", "desc"), limit(50)),
      (s) => setBatches(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    return () => { unsubA(); unsubB(); };
  }, [user]);

  if (user === undefined) return <p className="p-8 text-muted">Checking sign-in…</p>;
  if (!user) return <Login />;

  const openPath = (acct) => { setFocusAccount(acct); setTab("paths"); };

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-ink text-white md:w-56 md:border-b-0">
        <div className="px-5 py-4 md:py-6">
          <p className="text-lg font-bold">FinGuard AI</p>
          <p className="text-xs text-white/60">Fraud detection and risk analytics</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:px-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`block w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm md:mb-1
                ${tab === t.id ? "bg-white/15 font-semibold" : "text-white/75 hover:bg-white/10"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-6 py-3">
          <p className="text-sm text-muted">
            Scoring: <b className="text-ink">{API_URL ? "FastAPI model (falls back to demo)" : "Demo scorer"}</b>
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm">{user.email} <span className="text-muted">({role})</span></span>
            <button className={btnGhost} onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-6">
          {dataError && (
            <p role="alert" className="mb-4 rounded-md border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
              Firestore error: {dataError}. Check your security rules and that Firestore is created.
            </p>
          )}
          {tab === "dashboard" && <Dashboard alerts={alerts} batches={batches} goUpload={() => setTab("upload")} />}
          {tab === "upload" && <UploadPanel user={user} goAlerts={() => setTab("alerts")} />}
          {tab === "alerts" && <AlertsTable alerts={alerts} user={user} onOpenPath={openPath} />}
          {tab === "paths" && <PathMap alerts={alerts} initial={focusAccount} />}
        </main>
      </div>
    </div>
  );
}
