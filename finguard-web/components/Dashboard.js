
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LEVEL_COLOR, Panel, btnPrimary, money, num } from "./ui";

const RISK_COLORS = {
  Critical: "#fb7185",
  High: "#fb923c",
  Medium: "#facc15",
  Low: "#34d399",
};

const tooltipStyle = {
  backgroundColor: "#102236",
  border: "1px solid #294157",
  borderRadius: "12px",
  color: "#e6f1fb",
  boxShadow: "0 12px 30px rgba(0,0,0,.25)",
};

function MetricCard({ label, value, icon, tone, caption, index }) {
  return (
    <div
      className={`fg-card fg-animate-in fg-delay-${index + 1} group relative overflow-hidden p-5`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: tone }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {value}
          </p>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
          style={{
            color: tone,
            backgroundColor: `${tone}12`,
            borderColor: `${tone}35`,
          }}
        >
          <span className="text-xl" aria-hidden="true">{icon}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">{caption}</p>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{ width: "72%", background: tone, opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl border border-line bg-panel px-3 py-2 shadow-xl"
      style={tooltipStyle}
    >
      <p className="mb-1 text-xs text-muted">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-sm font-semibold text-ink">
          {item.name || item.dataKey}: {num(item.value)}
        </p>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
}

export default function Dashboard({
  alerts = [],
  batches = [],
  selectedBatchId = "",
  onSelectBatch,
  onDeleteBatch,
  deleteBusyId = "",
  onClearBatch,
  goUpload,
}) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const safeBatches = Array.isArray(batches) ? batches : [];

  // Batches are normally delivered newest-first by the Firestore query.
  const latestBatches = safeBatches.slice(0, 8);

  // Use the selected batch, or the newest batch if none is selected.
  const selectedBatch =
    safeBatches.find((batch) => batch.id === selectedBatchId) ||
    safeBatches[0] ||
    null;

  const activeBatchId = selectedBatch?.id || "";

  // Keep every chart and metric scoped to the selected batch.
  const batchAlerts = activeBatchId
    ? safeAlerts.filter((alert) => alert.batchId === activeBatchId)
    : [];

  const counts = selectedBatch?.counts || {};

  const total = Number(selectedBatch?.scanned) || 0;
  const alertCount = Number(selectedBatch?.alertCount) || 0;
  const critical = Number(counts.Critical) || 0;
  const atRisk = Number(selectedBatch?.amountAtRisk) || 0;

  const levelData = ["Critical", "High", "Medium", "Low"].map((level) => ({
    level,
    count: Number(counts[level]) || 0,
    fill: RISK_COLORS[level] || LEVEL_COLOR?.[level] || "#2dd4bf",
  }));

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    alerts: 0,
  }));

  batchAlerts.forEach((alert) => {
    const step = Number(alert.step);

    if (Number.isFinite(step)) {
      const hourIndex = ((step % 24) + 24) % 24;
      hours[hourIndex].alerts += 1;
    }
  });

  const stats = [
    {
      label: "Transactions scanned",
      value: num(total),
      icon: "↗",
      tone: "#2dd4bf",
      caption: "In selected dataset",
    },
    {
      label: "Alerts generated",
      value: num(alertCount),
      icon: "⌁",
      tone: "#38bdf8",
      caption: "Flagged in selected dataset",
    },
    {
      label: "Critical alerts",
      value: num(critical),
      icon: "!",
      tone: "#fb7185",
      caption: "Critical risk transactions",
    },
    {
      label: "Amount at risk",
      value: money(atRisk),
      icon: "$",
      tone: "#a78bfa",
      caption: "Reported by the scoring pipeline",
    },
  ];

  const handleOpen = (batch) => {
    if (!batch?.id) return;
    onSelectBatch?.(batch.id);
  };

  const handleDelete = (batch) => {
    if (!batch?.id || deleteBusyId === batch.id) return;
    onDeleteBatch?.(batch);
  };

  // Empty dashboard
  if (!safeBatches.length) {
    return (
      <div className="fg-animate-in space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Risk intelligence
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
            Security overview
          </h1>

          <p className="mt-2 text-sm text-muted">
            Monitor transactions, investigate anomalies, and explore risk insights.
          </p>
        </div>

        <div className="fg-card fg-grid flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-3xl">
            <span aria-hidden="true">⌁</span>
          </div>

          <h2 className="text-xl font-semibold text-ink">
            Your intelligence hub is ready
          </h2>

          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Upload a transaction CSV or run the built-in demo to populate
            your dashboard with risk analytics.
          </p>

          <button
            type="button"
            className={`${btnPrimary} mt-6`}
            onClick={goUpload}
          >
            Open transaction upload <span aria-hidden="true">→</span>
          </button>

          <p className="mt-4 text-xs text-muted">
            Analytics will appear after a batch has been processed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page heading */}
      <section className="fg-animate-in flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(45,212,191,.7)]" />
            Risk intelligence
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Security overview
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Analytics and risk exposure for your selected transaction dataset.
          </p>
        </div>

        <button
          type="button"
          onClick={goUpload}
          className={`${btnPrimary} fg-interactive self-start`}
        >
          <span aria-hidden="true">＋</span> Analyze transactions
        </button>
      </section>

      {/* Selected dataset */}
      <section className="fg-card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-xl text-accent">
            ▤
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Currently viewing
            </p>

            <p className="mt-1 truncate font-semibold text-ink">
              {selectedBatch?.fileName || "Transaction batch"}
            </p>

            <p className="mt-1 text-xs text-muted">
              {formatDate(selectedBatch?.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
            Selected dataset
          </span>

          {safeBatches.length > 1 && (
            <button
              type="button"
              onClick={() => onClearBatch?.()}
              className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-accent/40 hover:text-ink"
            >
              Show latest
            </button>
          )}
        </div>
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <MetricCard key={stat.label} {...stat} index={index} />
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Transactions by risk level">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Risk distribution in selected dataset
            </p>

            <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-muted">
              Risk breakdown
            </span>
          </div>

          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={levelData}
                margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 5"
                  stroke="var(--color-line)"
                  vertical={false}
                />

                <XAxis
                  dataKey="level"
                  tick={{ fill: "#91a4b7", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#91a4b7", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "rgba(148,163,184,0.06)" }}
                />

                <Bar
                  dataKey="count"
                  name="Transactions"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  {levelData.map((item) => (
                    <Cell key={item.level} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {levelData.map((item) => (
              <div key={item.level} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />

                <div className="min-w-0">
                  <p className="truncate text-xs text-muted">{item.level}</p>
                  <p className="text-sm font-semibold text-ink">
                    {num(item.count)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Alert activity">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Alerts grouped by transaction step
            </p>

            <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-muted">
              24-step view
            </span>
          </div>

          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={hours}
                margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 5"
                  stroke="var(--color-line)"
                  vertical={false}
                />

                <XAxis
                  dataKey="hour"
                  interval={3}
                  tick={{ fill: "#91a4b7", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#91a4b7", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "#2dd4bf", strokeDasharray: "4 4" }}
                />

                <Line
                  type="monotone"
                  dataKey="alerts"
                  name="Alerts"
                  stroke="#2dd4bf"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "#2dd4bf",
                    stroke: "#0d1b2a",
                    strokeWidth: 3,
                  }}
                  isAnimationActive
                  animationDuration={700}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-4 text-xs leading-5 text-muted">
            This chart uses alert records belonging to the selected batch.
            Grouping is based on the dataset's step field.
          </p>
        </Panel>
      </section>

      {/* Recent uploaded files */}
      <Panel title="Uploaded files & batch history">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Open a dataset to view its analytics, or delete a batch you no longer need.
          </p>

          <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-muted">
            {safeBatches.length} total uploads
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="px-3 py-3 font-medium">File</th>
                <th className="px-3 py-3 font-medium">Scanned</th>
                <th className="px-3 py-3 font-medium">Alerts</th>
                <th className="px-3 py-3 font-medium">Scoring time</th>
                <th className="px-3 py-3 font-medium">Scorer</th>
                <th className="px-3 py-3 font-medium">Uploaded by</th>
                <th className="px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {latestBatches.map((batch) => {
                const isSelected = batch.id === activeBatchId;
                const isDeleting = deleteBusyId === batch.id;

                return (
                  <tr
                    key={batch.id}
                    className={`border-b border-line/70 transition-colors last:border-0 ${
                      isSelected
                        ? "bg-accent/[0.06]"
                        : "hover:bg-white/[0.025]"
                    }`}
                  >
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent">
                          ▤
                        </span>

                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate font-medium text-ink">
                            {batch.fileName || "Transaction batch"}
                          </p>

                          {isSelected && (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                              Currently open
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-4 tabular-nums text-ink">
                      {num(batch.scanned)}
                    </td>

                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-lg border border-high/20 bg-high/10 px-2.5 py-1 font-semibold tabular-nums text-high">
                        {num(batch.alertCount)}
                      </span>
                    </td>

                    <td className="px-3 py-4 tabular-nums text-muted">
                      {Number.isFinite(Number(batch.scoringMs))
                        ? `${num(batch.scoringMs)} ms`
                        : "—"}
                    </td>

                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-2 text-muted">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            batch.mode === "api" ? "bg-accent" : "bg-medium"
                          }`}
                        />
                        {batch.mode === "api" ? "FastAPI" : "Demo"}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-muted">
                      {batch.uploadedBy || "—"}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpen(batch)}
                          disabled={isSelected}
                          className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent/50 hover:bg-accent/15 disabled:cursor-default disabled:opacity-50"
                          title="Open this dataset"
                        >
                          {isSelected ? "Open" : "Open"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(batch)}
                          disabled={isDeleting}
                          className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:border-red-400/50 hover:bg-red-400/15 disabled:cursor-wait disabled:opacity-50"
                          title="Delete this dataset and its alerts"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {safeBatches.length > 8 && (
          <p className="mt-4 text-xs text-muted">
            Showing the 8 most recent uploads. Your other batches remain in Firebase.
          </p>
        )}
      </Panel>
    </div>
  );
}
