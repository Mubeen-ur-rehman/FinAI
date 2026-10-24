"use client";
import { useEffect, useMemo, useState } from "react";
import { LEVEL_COLOR, Panel, btnPrimary, money } from "./ui";

const W = 640, H = 420, CX = W / 2, CY = H / 2;

export default function PathMap({ alerts, initial }) {
  const [input, setInput] = useState(initial || "");
  const [account, setAccount] = useState(initial || "");

  useEffect(() => { setInput(initial || ""); setAccount(initial || ""); }, [initial]);

  // Most-connected accounts, as quick suggestions
  const suggestions = useMemo(() => {
    const c = {};
    alerts.forEach((a) => { c[a.nameDest] = (c[a.nameDest] || 0) + 1; c[a.nameOrig] = (c[a.nameOrig] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  }, [alerts]);

  const links = useMemo(
    () => (account ? alerts.filter((a) => a.nameOrig === account || a.nameDest === account) : []),
    [alerts, account]
  );

  const neighbours = [...new Set(links.map((l) => (l.nameOrig === account ? l.nameDest : l.nameOrig)))].slice(0, 24);
  const pos = {};
  neighbours.forEach((n, i) => {
    const ang = (2 * Math.PI * i) / neighbours.length - Math.PI / 2;
    pos[n] = { x: CX + 175 * Math.cos(ang), y: CY + 150 * Math.sin(ang) };
  });

  return (
    <div className="space-y-6">
      <Panel title="Transaction path map">
        <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); setAccount(input.trim()); }}>
          <input aria-label="Account ID" placeholder="Account ID, e.g. C900000001" value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-72 rounded-md border border-line px-3 py-2 text-sm" />
          <button className={btnPrimary}>Trace account</button>
        </form>
        {!!suggestions.length && (
          <p className="mt-3 text-sm text-muted">
            Most connected:{" "}
            {suggestions.map((s) => (
              <button key={s} className="mr-3 text-accent hover:underline" onClick={() => { setInput(s); setAccount(s); }}>{s}</button>
            ))}
          </p>
        )}
      </Panel>

      {account && (
        <Panel title={`Connections for ${account} (${links.length} alerts)`}>
          {!links.length ? (
            <p className="text-muted">No stored alerts involve this account. Check the ID, or upload more data.</p>
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md bg-paper" role="img"
                aria-label={`Graph of ${links.length} alerts connected to ${account}`}>
                {links.map((l) => {
                  const other = l.nameOrig === account ? l.nameDest : l.nameOrig;
                  const p = pos[other]; if (!p) return null;
                  const outgoing = l.nameOrig === account;
                  return (
                    <line key={l.id} x1={outgoing ? CX : p.x} y1={outgoing ? CY : p.y}
                      x2={outgoing ? p.x : CX} y2={outgoing ? p.y : CY}
                      stroke={LEVEL_COLOR[l.risk_level]} strokeWidth={1.5 + l.risk_score / 40} opacity="0.7">
                      <title>{`${l.nameOrig} → ${l.nameDest}: ${money(l.amount)} (risk ${l.risk_score})`}</title>
                    </line>
                  );
                })}
                {neighbours.map((n) => (
                  <g key={n} transform={`translate(${pos[n].x} ${pos[n].y})`} className="cursor-pointer"
                    onClick={() => { setInput(n); setAccount(n); }}>
                    <circle r="9" fill="var(--color-panel)" stroke="var(--color-ink)" strokeWidth="1.5" />
                    <text y="24" textAnchor="middle" fontSize="10" fill="var(--color-muted)">{n}</text>
                  </g>
                ))}
                <circle cx={CX} cy={CY} r="16" fill="var(--color-accent)" />
                <text x={CX} y={CY + 32} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)">{account}</text>
              </svg>
              <p className="mt-2 text-xs text-muted">
                Line colour shows risk level, thickness shows score. Click a node to re-centre. Lines point from sender to receiver by hover text.
              </p>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
