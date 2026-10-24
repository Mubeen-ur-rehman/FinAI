"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { LEVEL_COLOR, Panel, btnPrimary, money, num } from "./ui";

export default function Dashboard({ alerts, batches, goUpload }) {
  if (!batches.length) {
    return (
      <Panel title="No data yet">
        <p className="mb-4 text-muted">Upload a transaction CSV, or run the built-in demo data, to see risk analytics here.</p>
        <button className={btnPrimary} onClick={goUpload}>Go to Upload</button>
      </Panel>
    );
  }

  const total = batches.reduce((s, b) => s + (b.scanned || 0), 0);
  const alertCount = batches.reduce((s, b) => s + (b.alertCount || 0), 0);
  const critical = batches.reduce((s, b) => s + (b.counts?.Critical || 0), 0);
  const atRisk = batches.reduce((s, b) => s + (b.amountAtRisk || 0), 0);

  const levelData = ["Critical", "High", "Medium"].map((l) => ({
    level: l, count: batches.reduce((s, b) => s + (b.counts?.[l] || 0), 0),
  }));

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, alerts: 0 }));
  alerts.forEach((a) => { hours[a.step % 24].alerts++; });

  const stats = [
    ["Transactions scanned", num(total)],
    ["Alerts raised", num(alertCount)],
    ["Critical alerts", num(critical)],
    ["Amount at risk", money(atRisk)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-panel md:grid-cols-4 md:divide-x">
        {stats.map(([label, value]) => (
          <div key={label} className="p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Alerts by risk level">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="level" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {levelData.map((d) => <Cell key={d.level} fill={LEVEL_COLOR[d.level]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Alerts by hour of day">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={hours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="hour" /><YAxis allowDecimals={false} /><Tooltip />
                <Line type="monotone" dataKey="alerts" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Recent uploads">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th className="pb-2">File</th><th>Scanned</th><th>Alerts</th><th>Scoring time</th><th>Scorer</th><th>By</th></tr>
            </thead>
            <tbody>
              {batches.slice(0, 8).map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="py-2">{b.fileName}</td><td>{num(b.scanned)}</td><td>{num(b.alertCount)}</td>
                  <td>{b.scoringMs} ms</td><td>{b.mode === "api" ? "FastAPI" : "Demo"}</td><td>{b.uploadedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
