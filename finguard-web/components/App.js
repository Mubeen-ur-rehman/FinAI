
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
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
  { id: "dashboard", label: "Overview", icon: "◫", description: "Risk analytics" },
  { id: "upload", label: "Analyze data", icon: "↥", description: "Import transactions" },
  { id: "alerts", label: "Fraud alerts", icon: "⌁", description: "Review flagged activity" },
  { id: "paths", label: "Path analysis", icon: "⌘", description: "Explore account paths" },
];

function Brand({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent shadow-[0_0_24px_rgba(45,212,191,0.08)]">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2.8 20 6v5.2c0 5.1-3.4 8.4-8 10-4.6-1.6-8-4.9-8-10V6l8-3.2Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      </div>

      <div className="min-w-0">
        <p className="truncate text-base font-bold tracking-tight text-ink">
          FinGuard <span className="text-accent">AI</span>
        </p>
        {!compact && (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Intelligence platform
          </p>
        )}
      </div>
    </div>
  );
}

function NavItems({ tab, setTab, mobile = false }) {
  return (
    <nav
      aria-label="Main navigation"
      className={
        mobile
          ? "flex gap-2 overflow-x-auto px-4 pb-3"
          : "space-y-1.5"
      }
    >
      {TABS.map((item) => {
        const active = tab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                    active
                      ? "border-accent/30 bg-accent/10 font-semibold text-accent"
                      : "border-line/70 bg-panel/60 text-muted hover:border-line hover:text-ink"
                  }`
                : `group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                    active
                      ? "border-accent/20 bg-accent/10 text-accent shadow-[inset_3px_0_0_#2dd4bf]"
                      : "border-transparent text-muted hover:border-line/70 hover:bg-white/[0.035] hover:text-ink"
                  }`
            }
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "bg-white/[0.035] text-muted group-hover:text-ink"
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-sm font-medium">
                {item.label}
              </span>

              {!mobile && (
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {item.description}
                </span>
              )}
            </span>

            {!mobile && active && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="fg-card fg-animate-in flex w-full max-w-sm flex-col items-center p-8 text-center">
        <Brand />
        <div className="mt-8 h-9 w-9 animate-spin rounded-full border-2 border-line border-t-accent" />
        <h1 className="mt-5 text-lg font-semibold text-ink">
          Securing your workspace
        </h1>
        <p className="mt-2 text-sm text-muted">
          Checking your authentication status…
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState("analyst");
  const [tab, setTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [focusAccount, setFocusAccount] = useState("");
  const [dataError, setDataError] = useState("");

  // Firebase authentication and user profile.
  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRole("analyst");
        setAlerts([]);
        setBatches([]);
        return;
      }

      try {
        const profileRef = doc(db, "users", currentUser.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          setRole(profileSnap.data().role || "analyst");
        } else {
          await setDoc(profileRef, {
            email: currentUser.email,
            role: "analyst",
          });
          setRole("analyst");
        }
      } catch (error) {
        setDataError(error.message || "Unable to load your user profile.");
      }
    });
  }, []);

  // Real-time Firestore subscriptions.
  useEffect(() => {
    if (!user) return;

    const onErr = (error) => {
      setDataError(error.message || "Unable to load Firestore data.");
    };

    const alertsQuery = query(
      collection(db, "alerts"),
      orderBy("risk_score", "desc"),
      limit(500)
    );

    const batchesQuery = query(
      collection(db, "batches"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribeAlerts = onSnapshot(
      alertsQuery,
      (snapshot) => {
        setAlerts(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      onErr
    );

    const unsubscribeBatches = onSnapshot(
      batchesQuery,
      (snapshot) => {
        setBatches(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      onErr
    );

    return () => {
      unsubscribeAlerts();
      unsubscribeBatches();
    };
  }, [user]);

  if (user === undefined) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Login />;
  }

  const openPath = (account) => {
    setFocusAccount(account);
    setTab("paths");
  };

  const currentTab = TABS.find((item) => item.id === tab) || TABS[0];
  const apiEnabled = Boolean(API_URL);

  return (
    <div className="min-h-screen bg-paper text-ink md:flex">
      {/* Desktop sidebar */}
      <aside className="relative hidden w-[270px] shrink-0 border-r border-line/80 bg-panel/80 md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="border-b border-line/70 px-6 py-6">
          <Brand />

          <div className="mt-7 rounded-xl border border-accent/15 bg-accent/[0.045] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-30" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-xs font-semibold text-accent">
                Risk monitoring
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Transaction intelligence and fraud analysis in one workspace.
            </p>
          </div>
        </div>

        <div className="px-5 pb-2 pt-6">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Workspace
          </p>
          <NavItems tab={tab} setTab={setTab} />
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-xl border border-line bg-paper/70 p-4">
            <div className="flex items-center gap-2">
              <span className="text-accent" aria-hidden="true">◇</span>
              <p className="text-xs font-semibold text-ink">Detection engine</p>
            </div>

            <p className="mt-2 text-xs leading-5 text-muted">
              {apiEnabled
                ? "API configured. Requests may fall back to demo scoring."
                : "Demo scoring mode. Configure your API to enable model requests."}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  apiEnabled ? "bg-accent" : "bg-medium"
                }`}
              />
              <span className="text-[11px] font-medium text-muted">
                {apiEnabled ? "API configured" : "Demo mode"}
              </span>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-muted">
            FinGuard AI · Risk intelligence
          </p>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="min-w-0 flex-1">
        {/* Mobile brand header */}
        <div className="border-b border-line/80 bg-panel/90 px-4 py-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand compact />

            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1.5 text-[10px] font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {apiEnabled ? "API configured" : "Demo mode"}
            </span>
          </div>
        </div>

        {/* Top navigation bar */}
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
          <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                FinGuard AI / Workspace
              </p>

              <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                {currentTab.label}
              </h1>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    apiEnabled ? "bg-accent" : "bg-medium"
                  }`}
                />
                <span className="text-xs text-muted">
                  {apiEnabled ? "FastAPI configured" : "Demo scorer"}
                </span>
              </div>

              <div className="hidden h-8 w-px bg-line sm:block" />

              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-sm font-bold text-accent">
                  {(user.email || "U").charAt(0).toUpperCase()}
                </div>

                <div className="hidden min-w-0 lg:block">
                  <p className="max-w-[180px] truncate text-xs font-semibold text-ink">
                    {user.email || "Signed-in user"}
                  </p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted">
                    {role || "analyst"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={`${btnGhost} !rounded-xl !px-3 !py-2`}
                onClick={() => signOut(auth)}
                aria-label="Sign out of FinGuard AI"
                title="Sign out"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                </svg>
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          {/* Mobile navigation */}
          <div className="border-t border-line/60 md:hidden">
            <NavItems tab={tab} setTab={setTab} mobile />
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {dataError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-critical/25 bg-critical/5 p-4"
            >
              <span className="mt-0.5 text-critical" aria-hidden="true">
                !
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-critical">
                  Data connection issue
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-muted">
                  {dataError}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Check your Firestore security rules and Firebase configuration.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDataError("")}
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-ink"
                aria-label="Dismiss error message"
              >
                ×
              </button>
            </div>
          )}

          <div key={tab} className="fg-animate-in">
            {tab === "dashboard" && (
              <Dashboard
                alerts={alerts}
                batches={batches}
                goUpload={() => setTab("upload")}
              />
            )}

            {tab === "upload" && (
              <UploadPanel
                user={user}
                goAlerts={() => setTab("alerts")}
              />
            )}

            {tab === "alerts" && (
              <AlertsTable
                alerts={alerts}
                user={user}
                onOpenPath={openPath}
              />
            )}

            {tab === "paths" && (
              <PathMap
                alerts={alerts}
                initial={focusAccount}
              />
            )}
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 py-5 text-[11px] text-muted">
            <p>FinGuard AI · Transaction risk intelligence</p>
            <p>Live data from your configured Firebase project</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
