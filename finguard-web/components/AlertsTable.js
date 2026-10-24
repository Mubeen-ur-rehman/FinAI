"use client";
import { Fragment, useMemo, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LevelBadge, Panel, RiskGauge, btnGhost, money } from "./ui";

const STATUS_LABEL = { open: "Open", false_positive: "False positive", confirmed: "Confirmed fraud" };

export default function AlertsTable({ alerts, user, onOpenPath }) {
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => alerts.filter((a) =>
    (level === "All" || a.risk_level === level) &&
    (status === "All" || a.status === status) &&
    (!search || a.nameOrig.includes(search) || a.nameDest.includes(search))
  ), [alerts, level, status, search]);

  async function review(a, newStatus) {
    setError("");
    try {
      await updateDoc(doc(db, "alerts", a.id), {
        status: newStatus, reviewedBy: user.email, reviewedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "auditLog"), {
        event: `alert_${newStatus}`, alertId: a.id, user: user.email, createdAt: serverTimestamp(),
      });
    } catch (e) {
      setError(e.message);
    }
  }

  function exportCsv() {
    const cols = ["risk_score", "risk_level", "status", "type", "amount", "nameOrig", "nameDest", "step", "fraud_prob", "anomaly_score"];
    const lines = [cols.join(",")].concat(
      rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))
    );
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "finguard-alerts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const select = "rounded-md border border-line bg-panel px-3 py-2 text-sm";

  return (
    <Panel title={`Alert queue (${rows.length})`}
      action={<button className={btnGhost} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Risk level" className={select} value={level} onChange={(e) => setLevel(e.target.value)}>
          {["All", "Critical", "High", "Medium"].map((l) => <option key={l}>{l}</option>)}
        </select>
        <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="All">All</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input aria-label="Search account" placeholder="Search account ID" className={select}
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-critical">Could not save review: {error}</p>}

      {!rows.length ? (
        <p className="text-muted">No alerts match these filters. Upload data or change the filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th className="pb-2">Score</th><th>Level</th><th>Type</th><th>Amount</th><th>From</th><th>To</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Fragment key={a.id}>
                  <tr className="cursor-pointer border-t border-line hover:bg-paper"
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                    <td className="py-2 font-bold">{a.risk_score}</td>
                    <td><LevelBadge level={a.risk_level} /></td>
                    <td>{a.type}</td><td>{money(a.amount)}</td>
                    <td>{a.nameOrig}</td><td>{a.nameDest}</td>
                    <td>{STATUS_LABEL[a.status]}</td>
                  </tr>
                  {openId === a.id && (
                    <tr className="bg-paper">
                      <td colSpan={7} className="p-4">
                        <div className="flex flex-wrap items-center gap-8">
                          <RiskGauge score={a.risk_score} level={a.risk_level} />
                          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <dt className="text-muted">Fraud probability</dt><dd>{(a.fraud_prob * 100).toFixed(1)}%</dd>
                            <dt className="text-muted">Anomaly score</dt><dd>{(a.anomaly_score * 100).toFixed(1)}%</dd>
                            <dt className="text-muted">Sender balance</dt><dd>{money(a.oldbalanceOrg)} → {money(a.newbalanceOrig)}</dd>
                            <dt className="text-muted">Receiver balance</dt><dd>{money(a.oldbalanceDest)} → {money(a.newbalanceDest)}</dd>
                            {a.reviewedBy && (<><dt className="text-muted">Reviewed by</dt><dd>{a.reviewedBy}</dd></>)}
                          </dl>
                          <div className="flex flex-wrap gap-2">
                            <button className={btnGhost} onClick={() => review(a, "false_positive")}>Mark false positive</button>
                            <button className={`${btnGhost} border-critical text-critical`} onClick={() => review(a, "confirmed")}>Confirm fraud</button>
                            <button className={btnGhost} onClick={() => onOpenPath(a.nameDest)}>Trace receiver</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
