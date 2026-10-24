"use client";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { processRows, generateDemoRows } from "@/lib/pipeline";
import { Panel, btnGhost, btnPrimary, money, num } from "./ui";

export default function UploadPanel({ user, goAlerts }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  async function run(rows, name) {
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await processRows(rows, user, name));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return setError("Please choose a .csv file.");
    setError("");
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (r) => run(r.data, file.name),
      error: (e) => setError(e.message),
    });
  }

  return (
    <div className="space-y-6">
      <Panel title="Upload transactions">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          className={`rounded-lg border-2 border-dashed p-10 text-center ${drag ? "border-accent bg-accent/5" : "border-line"}`}
        >
          <p className="mb-1 font-semibold">Drop a CSV here</p>
          <p className="mb-4 text-sm text-muted">
            Required columns: step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig, nameDest, oldbalanceDest, newbalanceDest
          </p>
          <input ref={input} type="file" accept=".csv" hidden onChange={(e) => handleFile(e.target.files[0])} />
          <div className="flex justify-center gap-3">
            <button className={btnPrimary} disabled={busy} onClick={() => input.current.click()}>Choose file</button>
            <button className={btnGhost} disabled={busy} onClick={() => run(generateDemoRows(), "demo-data (generated)")}>
              Run demo data
            </button>
          </div>
        </div>
        {busy && <p className="mt-4 text-sm text-muted" role="status">Scoring transactions and saving alerts…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-critical">Upload failed: {error}</p>}
      </Panel>

      {result && (
        <Panel title="Scan complete" action={<button className={btnPrimary} onClick={goAlerts}>Review alerts</button>}>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div><dt className="text-muted">Scanned</dt><dd className="text-lg font-bold">{num(result.scanned)}</dd></div>
            <div><dt className="text-muted">Alerts saved</dt><dd className="text-lg font-bold">{num(result.alertCount)}</dd></div>
            <div><dt className="text-muted">Amount at risk</dt><dd className="text-lg font-bold">{money(result.amountAtRisk)}</dd></div>
            <div>
              <dt className="text-muted">Scoring time ({result.mode === "api" ? "FastAPI" : "demo scorer"})</dt>
              <dd className="text-lg font-bold">{result.scoringMs} ms</dd>
            </div>
          </dl>
        </Panel>
      )}
    </div>
  );
}
