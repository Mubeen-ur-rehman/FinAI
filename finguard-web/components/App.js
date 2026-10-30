
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
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
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf] shadow-[0_0_24px_rgba(45,212,191,0.08)]">
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
        <p className="truncate text-base font-bold tracking-tight text-[#f1f5f9]">
          FinGuard <span className="text-[#2dd4bf]">AI</span>
        </p>

        {!compact && (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
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
      className={mobile ? "flex gap-2 overflow-x-auto px-4 pb-3" : "space-y-2"}
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
                      ? "border-[#2dd4bf]/40 bg-[#2dd4bf]/10 font-semibold text-[#5eead4]"
                      : "border-[#26394d] bg-[#0d1b2a] text-[#cbd5e1] hover:border-[#3c536b] hover:text-white"
                  }`
                : `group flex w-full items-center gap-3 rounded-xl border px-3 py-3.5 text-left transition-all duration-200 ${
                    active
                      ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-[#5eead4] shadow-[inset_3px_0_0_#2dd4bf]"
                      : "border-transparent text-[#cbd5e1] hover:border-[#30475b] hover:bg-[#112337] hover:text-white"
                  }`
            }
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition-colors ${
                active
                  ? "bg-[#2dd4bf]/10 text-[#5eead4]"
                  : "bg-[#ffffff08] text-[#a9bbce] group-hover:text-white"
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-sm font-semibold">
                {item.label}
              </span>

              {!mobile && (
                <span
                  className={`mt-1 block truncate text-[11px] ${
                    active ? "text-[#8de9dd]" : "text-[#94a3b8]"
                  }`}
                >
                  {item.description}
                </span>
              )}
            </span>

            {!mobile && active && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.55)]"
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
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] p-6 text-[#e6f1fb]">
      <div className="fg-card fg-animate-in flex w-full max-w-sm flex-col items-center p-8 text-center">
        <Brand />

        <div className="mt-8 h-9 w-9 animate-spin rounded-full border-2 border-[#203448] border-t-[#2dd4bf]" />

        <h1 className="mt-5 text-lg font-semibold">
          Securing your workspace
        </h1>

        <p className="mt-2 text-sm text-[#91a4b7]">
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
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [deleteBusyId, setDeleteBusyId] = useState("");

  // Authentication and user profile.
  useEffect(() => {
    let active = true;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return;

        setUser(currentUser);
        setDataError("");
        setAlerts([]);
        setBatches([]);
        setFocusAccount("");
        setRole("analyst");
        setUploadResult(null);
        setSelectedBatchId("");

        if (!currentUser) return;

        try {
          const profileRef = doc(db, "users", currentUser.uid);
          const profileSnap = await getDoc(profileRef);

          if (!active) return;

          if (profileSnap.exists()) {
            setRole(profileSnap.data().role || "analyst");
          } else {
            await setDoc(profileRef, {
              email: currentUser.email || "",
              role: "analyst",
            });

            if (active) setRole("analyst");
          }
        } catch (error) {
          if (active) {
            setDataError(
              error.message || "Unable to load your user profile."
            );
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, []);

  // Subscribe to the signed-in user's batches and alerts.
  useEffect(() => {
    if (!user?.uid) {
      setAlerts([]);
      setBatches([]);
      setSelectedBatchId("");
      return;
    }

    let active = true;

    const onErr = (error) => {
      if (active) {
        setDataError(
          error.message || "Unable to load Firestore data."
        );
      }
    };

    const alertsQuery = query(
      collection(db, "alerts"),
      where("uploadedByUid", "==", user.uid),
      orderBy("risk_score", "desc"),
      limit(500)
    );

    const batchesQuery = query(
      collection(db, "batches"),
      where("uploadedByUid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribeAlerts = onSnapshot(
      alertsQuery,
      (snapshot) => {
        if (!active) return;

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
        if (!active) return;

        const loadedBatches = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setBatches(loadedBatches);

        // Keep the selected batch if it still exists.
        // Otherwise, select the latest available batch.
        setSelectedBatchId((currentId) => {
          if (
            currentId &&
            loadedBatches.some((batch) => batch.id === currentId)
          ) {
            return currentId;
          }

          return loadedBatches[0]?.id || "";
        });
      },
      onErr
    );

    return () => {
      active = false;
      unsubscribeAlerts();
      unsubscribeBatches();
    };
  }, [user?.uid]);

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

  // Delete a batch and its related alerts.
  const handleDeleteBatch = async (batch) => {
    if (!batch?.id || !user?.uid) return;

    const confirmed = window.confirm(
      `Delete upload "${batch.fileName || "Transaction batch"}" and its saved alerts? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeleteBusyId(batch.id);
    setDataError("");

    try {
      const relatedAlertsQuery = query(
        collection(db, "alerts"),
        where("uploadedByUid", "==", user.uid),
        where("batchId", "==", batch.id)
      );

      const alertSnapshot = await getDocs(relatedAlertsQuery);

      // Delete related alerts in groups.
      for (let i = 0; i < alertSnapshot.docs.length; i += 400) {
        const group = alertSnapshot.docs.slice(i, i + 400);

        await Promise.all(
          group.map((item) => deleteDoc(item.ref))
        );
      }

      // Delete the batch document.
      await deleteDoc(doc(db, "batches", batch.id));

      if (selectedBatchId === batch.id) {
        const remainingBatches = batches
          .filter((item) => item.id !== batch.id)
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setSelectedBatchId(remainingBatches[0]?.id || "");
      }

      if (uploadResult?.batchId === batch.id) {
        setUploadResult(null);
      }
    } catch (error) {
      setDataError(
        error?.message || "Unable to delete this upload."
      );
    } finally {
      setDeleteBusyId("");
    }
  };

  // Only alerts belonging to the selected batch are shown.
  const visibleAlerts = selectedBatchId
    ? alerts.filter((alert) => alert.batchId === selectedBatchId)
    : [];

  const currentTab =
    TABS.find((item) => item.id === tab) || TABS[0];

  const apiEnabled = Boolean(API_URL);

  return (
    <div className="min-h-screen bg-[#07111f] text-[#e6f1fb] md:flex">
      {/* Desktop sidebar */}
      <aside className="relative hidden w-[270px] shrink-0 border-r border-[#203448] bg-[#081321] md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="border-b border-[#203448] px-6 py-6">
          <Brand />

          <div className="mt-7 rounded-xl border border-[#2dd4bf]/20 bg-[#0d1b2a] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2dd4bf] opacity-30" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2dd4bf]" />
              </span>

              <span className="text-xs font-semibold text-[#5eead4]">
                Risk monitoring
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-[#a9bbce]">
              Transaction intelligence and fraud analysis in one workspace.
            </p>
          </div>
        </div>

        <div className="px-5 pb-2 pt-6">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8295aa]">
            Workspace
          </p>

          <NavItems tab={tab} setTab={setTab} />
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-xl border border-[#26394d] bg-[#0d1b2a] p-4">
            <div className="flex items-center gap-2">
              <span className="text-[#2dd4bf]" aria-hidden="true">
                ◇
              </span>

              <p className="text-xs font-semibold text-[#e6f1fb]">
                Detection engine
              </p>
            </div>

            <p className="mt-2 text-xs leading-5 text-[#a9bbce]">
              {apiEnabled
                ? "API configured. Requests may fall back to demo scoring."
                : "Demo scoring mode. Configure your API to enable model requests."}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  apiEnabled ? "bg-[#2dd4bf]" : "bg-[#facc15]"
                }`}
              />

              <span className="text-[11px] font-medium text-[#a9bbce]">
                {apiEnabled ? "API configured" : "Demo mode"}
              </span>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-[#8295aa]">
            FinGuard AI · Risk intelligence
          </p>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="min-w-0 flex-1">
        {/* Mobile brand header */}
        <div className="border-b border-[#203448] bg-[#0b1726] px-4 py-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand compact />

            <span className="inline-flex items-center gap-2 rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/5 px-2.5 py-1.5 text-[10px] font-semibold text-[#5eead4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
              {apiEnabled ? "API configured" : "Demo mode"}
            </span>
          </div>
        </div>

        {/* Top navigation */}
        <header className="sticky top-0 z-20 border-b border-[#203448] bg-[#07111f]/95 backdrop-blur-xl">
          <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#91a4b7]">
                FinGuard AI / Workspace
              </p>

              <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-[#e6f1fb]">
                {currentTab.label}
              </h1>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-[#203448] bg-[#0d1b2a] px-3 py-2 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    apiEnabled ? "bg-[#2dd4bf]" : "bg-[#facc15]"
                  }`}
                />

                <span className="text-xs text-[#a9bbce]">
                  {apiEnabled ? "FastAPI configured" : "Demo scorer"}
                </span>
              </div>

              <div className="hidden h-8 w-px bg-[#203448] sm:block" />

              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/10 text-sm font-bold text-[#5eead4]">
                  {(user.email || "U").charAt(0).toUpperCase()}
                </div>

                <div className="hidden min-w-0 lg:block">
                  <p className="max-w-[180px] truncate text-xs font-semibold text-[#e6f1fb]">
                    {user.email || "Signed-in user"}
                  </p>

                  <p className="mt-0.5 text-[10px] capitalize text-[#91a4b7]">
                    {role || "analyst"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={`${btnGhost} !rounded-xl !border-[#26394d] !bg-[#0d1b2a] !px-3 !py-2 !text-[#cbd5e1] hover:!bg-[#172b40] hover:!text-white`}
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
          <div className="border-t border-[#203448] md:hidden">
            <NavItems tab={tab} setTab={setTab} mobile />
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {dataError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-[#fb7185]/30 bg-[#fb7185]/5 p-4"
            >
              <span
                className="mt-0.5 text-[#fb7185]"
                aria-hidden="true"
              >
                !
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#fb7185]">
                  Data connection issue
                </p>

                <p className="mt-1 break-words text-xs leading-5 text-[#a9bbce]">
                  {dataError}
                </p>

                <p className="mt-1 text-xs text-[#91a4b7]">
                  Check your Firestore security rules and Firebase configuration.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDataError("")}
                className="rounded-lg px-2 py-1 text-sm text-[#91a4b7] hover:bg-white/5 hover:text-white"
                aria-label="Dismiss error message"
              >
                ×
              </button>
            </div>
          )}

          <div key={tab} className="fg-animate-in">
            {tab === "dashboard" && (
              <Dashboard
                alerts={visibleAlerts}
                batches={batches}
                selectedBatchId={selectedBatchId}
                onSelectBatch={(id) => setSelectedBatchId(id)}
                onDeleteBatch={handleDeleteBatch}
                deleteBusyId={deleteBusyId}
                onClearBatch={() => setSelectedBatchId("")}
                goUpload={() => setTab("upload")}
              />
            )}

            {tab === "upload" && (
              <UploadPanel
                user={user}
                initialResult={uploadResult}
                onResult={(output) => {
                  setUploadResult(output);

                  if (output?.batchId) {
                    setSelectedBatchId(output.batchId);
                  }
                }}
                goAlerts={() => setTab("alerts")}
              />
            )}

            {tab === "alerts" && (
              <AlertsTable
                alerts={visibleAlerts}
                user={user}
                onOpenPath={openPath}
              />
            )}

            {tab === "paths" && (
              <PathMap
                alerts={visibleAlerts}
                initial={focusAccount}
              />
            )}
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#203448] py-5 text-[11px] text-[#91a4b7]">
            <p>FinGuard AI · Transaction risk intelligence</p>
            <p>Live data from your configured Firebase project</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
