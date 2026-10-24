export const LEVEL_COLOR = {
  Critical: "var(--color-critical)",
  High: "var(--color-high)",
  Medium: "var(--color-medium)",
  Low: "var(--color-low)",
};

export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export const num = (n) => new Intl.NumberFormat("en-US").format(n || 0);

export function LevelBadge({ level }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: LEVEL_COLOR[level] }}
    >
      {level}
    </span>
  );
}

export function Panel({ title, children, className = "", action }) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// Ring gauge for the 0-100 risk score
export function RiskGauge({ score, level }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`Risk score ${score} of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="9" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={LEVEL_COLOR[level]} strokeWidth="9"
        strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="52" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--color-ink)">{score}</text>
      <text x="50" y="68" textAnchor="middle" fontSize="9" fill="var(--color-muted)">{level}</text>
    </svg>
  );
}

export const btn =
  "rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary = `${btn} bg-accent text-white hover:bg-accent-dark`;
export const btnGhost = `${btn} border border-line bg-panel hover:bg-paper`;
