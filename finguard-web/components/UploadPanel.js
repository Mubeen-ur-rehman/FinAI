
"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { processRows, generateDemoRows } from "@/lib/pipeline";
import {
  Panel,
  btnGhost,
  btnPrimary,
  money,
  num,
} from "./ui";

function Metric({ label, value }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-bold">{num(value ?? 0)}</dd>
    </div>
  );
}

function IssueList({ title, values }) {
  const issues = Object.entries(values || {}).filter(
    ([, count]) => count > 0
  );

  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>

      {issues.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {issues.map(([column, count]) => (
            <li key={column}>
              {column}: {num(count)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No issues detected.
        </p>
      )}
    </div>
  );
}

function downloadPreprocessingReport(result) {
  if (!result?.preprocessing) {
    alert("No preprocessing report is available yet.");
    return;
  }

  const report = {
    fileName: "FinGuard AI preprocessing report",
    generatedAt: new Date().toISOString(),
    scoringMode: result.mode,

    scanSummary: {
      rowsScored: result.scanned,
      alertsSaved: result.alertCount,
      scoringTimeMs: result.scoringMs,
      amountAtRisk: result.amountAtRisk,
      riskCounts: result.counts,
    },

    preprocessing: result.preprocessing,
  };

  const blob = new Blob(
    [JSON.stringify(report, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "finguard-preprocessing-report.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export default function UploadPanel({ user, goAlerts }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false);

  const input = useRef(null);

  async function run(rows, name) {
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const output = await processRows(rows, user, name);
      setResult(output);
    } catch (e) {
      setError(
        e?.message || "Unable to process the dataset."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file.");
      return;
    }

    setError("");
    setResult(null);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: "greedy",

      complete: (parsed) => {
        if (parsed.errors?.length) {
          setError(
            `CSV parsing found ${parsed.errors.length} issue(s). ` +
              `First issue: ${parsed.errors[0].message}.`
          );
          return;
        }

        run(parsed.data, file.name);
      },

      error: (parseError) => {
        setError(
          parseError?.message || "Unable to read the CSV file."
        );
      },
    });
  }

  const prep = result?.preprocessing;

  const modeLabel =
    result?.mode === "api"
      ? "FastAPI"
      : result?.mode === "mixed"
        ? "Mixed API/demo"
        : "Demo scorer";

  return (
    <div className="space-y-6">
      {/* CSV upload panel */}
      <Panel title="Upload transactions">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);

            if (!busy) {
              handleFile(event.dataTransfer.files[0]);
            }
          }}
          className={`rounded-lg border-2 border-dashed p-10 text-center ${
            drag
              ? "border-accent bg-accent/5"
              : "border-line"
          }`}
        >
          <p className="mb-1 font-semibold">
            Drop a CSV here
          </p>

          <p className="mb-4 text-sm text-muted">
            Required columns: step, type, amount, nameOrig,
            oldbalanceOrg, newbalanceOrig, nameDest,
            oldbalanceDest, newbalanceDest
          </p>

          <input
            ref={input}
            type="file"
            accept=".csv"
            hidden
            onChange={(event) => {
              handleFile(event.target.files[0]);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Choose file
            </button>

            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() =>
                run(
                  generateDemoRows(),
                  "demo-data (generated)"
                )
              }
            >
              Run demo data
            </button>
          </div>
        </div>

        {busy && (
          <p
            className="mt-4 text-sm text-muted"
            role="status"
          >
            Validating data, preprocessing rows, scoring
            transactions, and saving alerts…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-critical"
          >
            Upload failed: {error}
          </p>
        )}
      </Panel>

      {/* Scan results */}
      {result && (
        <>
          <Panel
            title="Scan complete"
            action={
              <button
                type="button"
                className={btnPrimary}
                onClick={goAlerts}
              >
                Review alerts
              </button>
            }
          >
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Metric
                label="Rows scored"
                value={result.scanned}
              />

              <Metric
                label="Alerts saved"
                value={result.alertCount}
              />

              <div>
                <dt className="text-muted">
                  Amount at risk
                </dt>
                <dd className="text-lg font-bold">
                  {money(result.amountAtRisk)}
                </dd>
              </div>

              <div>
                <dt className="text-muted">
                  Scoring time ({modeLabel})
                </dt>
                <dd className="text-lg font-bold">
                  {num(result.scoringMs)} ms
                </dd>
              </div>
            </dl>
          </Panel>

          {/* Preprocessing and data-quality report */}
          {prep && (
            <Panel
              title="Preprocessing and data-quality report"
              action={
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() =>
                    downloadPreprocessingReport(result)
                  }
                >
                  Download report
                </button>
              }
            >
              <div className="mb-5 rounded-lg border border-line p-4">
                <p className="text-sm text-muted">
                  Data-quality score
                </p>

                <p className="text-3xl font-bold">
                  {prep.dataQualityScore}/100
                </p>

                <p className="mt-1 text-xs text-muted">
                  Heuristic score based on detected data-quality
                  issues; it is not a fraud probability.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <Metric
                  label="Original rows"
                  value={prep.originalRows}
                />

                <Metric
                  label="Empty rows removed"
                  value={prep.emptyRowsRemoved}
                />

                <Metric
                  label="Valid rows retained"
                  value={prep.validRows}
                />

                <Metric
                  label="Rows rejected"
                  value={prep.rejectedRows}
                />

                <Metric
                  label="Exact duplicates detected"
                  value={prep.exactDuplicateRows}
                />

                <Metric
                  label="Unsupported types skipped"
                  value={prep.unsupportedTypeRows}
                />

                <Metric
                  label="Rows scored"
                  value={prep.rowsScored}
                />
              </dl>

              <div className="mt-6 space-y-5">
                <IssueList
                  title="Missing required values"
                  values={prep.missingValues}
                />

                <IssueList
                  title="Invalid numeric values"
                  values={prep.invalidNumericValues}
                />

                <IssueList
                  title="Negative numeric values"
                  values={prep.negativeValues}
                />

                <p className="text-xs text-muted">
                  Duplicate policy: {prep.duplicatePolicy}{" "}
                  Unsupported transaction types are excluded
                  from scoring, not treated as malformed rows.
                </p>

                {prep.rejectedSamples?.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">
                      Sample validation issues
                    </h3>

                    <ul className="space-y-2 text-sm">
                      {prep.rejectedSamples.map((sample) => (
                        <li
                          key={sample.rowNumber}
                          className="rounded-md border border-line p-3"
                        >
                          <p className="font-semibold">
                            CSV row {sample.rowNumber}
                          </p>

                          <ul className="list-disc pl-5 text-muted">
                            {sample.reasons.map(
                              (reason, index) => (
                                <li
                                  key={`${sample.rowNumber}-${index}`}
                                >
                                  {reason}
                                </li>
                              )
                            )}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
