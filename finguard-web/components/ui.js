
export const LEVEL_COLOR = {
  Critical: "var(--color-critical)",
  High: "var(--color-high)",
  Medium: "var(--color-medium)",
  Low: "var(--color-low)",
};

const LEVEL_STYLES = {
  Critical: "border-critical/25 bg-critical/10 text-critical",
  High: "border-high/25 bg-high/10 text-high",
  Medium: "border-medium/25 bg-medium/10 text-medium",
  Low: "border-low/25 bg-low/10 text-low",
};

export const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

export const num = (n) =>
  new Intl.NumberFormat("en-US").format(
    Number.isFinite(Number(n)) ? Number(n) : 0
  );

export function LevelBadge({ level }) {
  const safeLevel = LEVEL_STYLES[level] ? level : "Low";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
        LEVEL_STYLES[safeLevel]
      }`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: LEVEL_COLOR[safeLevel] }}
        aria-hidden="true"
      />
      {level || "Unknown"}
    </span>
  );
}

export function Panel({
  title,
  children,
  className = "",
  action,
}) {
  return (
    <section
      className={`fg-card min-w-0 overflow-hidden ${className}`}
    >
      {title && (
        <header className="flex min-h-[57px] items-center justify-between gap-3 border-b border-line/80 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-ink">
            {title}
          </h2>

          {action && (
            <div className="shrink-0">{action}</div>
          )}
        </header>
      )}

      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

// Animated SVG ring gauge for a risk score from 0 to 100.
export function RiskGauge({ score, level }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const numericScore = Number(score);
  const safeScore = Number.isFinite(numericScore)
    ? Math.min(100, Math.max(0, numericScore))
    : 0;

  const safeLevel = LEVEL_COLOR[level] ? level : "Low";
  const dashOffset =
    circumference - (safeScore / 100) * circumference;

  return (
    <div className="relative inline-flex h-32 w-32 items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90 overflow-visible"
        role="img"
        aria-label={`Risk score ${safeScore} of 100, ${level || "Unknown"} risk`}
      >
        <defs>
          <filter id="fg-risk-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="8"
        />

        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={LEVEL_COLOR[safeLevel]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          filter="url(#fg-risk-glow)"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight text-ink">
          {Math.round(safeScore)}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">
          Risk score
        </span>
        <span
          className="mt-1 text-xs font-semibold"
          style={{ color: LEVEL_COLOR[safeLevel] }}
        >
          {level || "Unknown"}
        </span>
      </div>
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

export const btnPrimary =
  `${btn} bg-accent text-[#07111f] shadow-[0_4px_18px_rgba(45,212,191,0.12)] hover:bg-accent-dark hover:shadow-[0_4px_22px_rgba(45,212,191,0.2)]`;

export const btnGhost =
  `${btn} border border-line bg-panel text-ink hover:border-accent/40 hover:bg-white/[0.04]`;
