
"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
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
    ([, count]) => Number(count) > 0
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

  const prep = result.preprocessing;
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;

  let y = 20;

  function addPageIfNeeded(height = 8) {
    if (y + height > pageHeight - 15) {
      pdf.addPage();
      y = 20;
    }
  }

  function addHeading(text) {
    addPageIfNeeded(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(text, margin, y);
    y += 8;
  }

  function addText(label, value) {
    const text = `${label}: ${value ?? "N/A"}`;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const lines = pdf.splitTextToSize(text, maxWidth);

    addPageIfNeeded(lines.length * 5 + 2);
    pdf.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("FinGuard AI", margin, y);
  y += 10;

  pdf.setFontSize(15);
  pdf.text("Preprocessing Report", margin, y);
  y += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Generated: ${new Date().toLocaleString()}`,
    margin,
    y
  );
  y += 10;

  addHeading("Upload Information");
  addText("File name", result.fileName);
  addText("Batch ID", result.batchId);
  addText("Scoring mode", result.mode);

  addHeading("Scan Summary");
  addText("Rows scored", result.scanned);
  addText("Alerts saved", result.alertCount);
  addText("Scoring time (ms)", result.scoringMs);
  addText("Amount at risk", result.amountAtRisk);

  if (result.counts) {
    addText("Risk counts", JSON.stringify(result.counts));
  }

  addHeading("Data Quality");
  addText(
    "Data quality score",
    prep.dataQualityScore != null
      ? `${prep.dataQualityScore}/100`
      : "N/A"
  );
  addText("Original rows", prep.originalRows);
  addText("Empty rows removed", prep.emptyRowsRemoved);
  addText("Valid rows retained", prep.validRows);
  addText("Rows rejected", prep.rejectedRows);
  addText("Exact duplicates detected", prep.exactDuplicateRows);
  addText("Unsupported types skipped", prep.unsupportedTypeRows);
  addText("Rows scored", prep.rowsScored);
  addText("Duplicate policy", prep.duplicatePolicy);

  function addIssueSection(title, values) {
    addHeading(title);

    const entries = Object.entries(values || {});

    if (!entries.length) {
      addText("Result", "No issues reported.");
      return;
    }

    entries.forEach(([column, count]) => {
      addText(column, count);
    });
  }

  addIssueSection(
    "Missing Required Values",
    prep.missingValues
  );

  addIssueSection(
    "Invalid Numeric Values",
    prep.invalidNumericValues
  );

  addIssueSection(
    "Negative Numeric Values",
    prep.negativeValues
  );

  addHeading("Sample Validation Issues");

  if (prep.rejectedSamples?.length) {
    prep.rejectedSamples.forEach((sample) => {
      addText("CSV row", sample.rowNumber);

      (sample.reasons || []).forEach((reason) => {
        addText("Issue", reason);
      });
    });
  } else {
    addText(
      "Validation issues",
      "No rejected samples available."
    );
  }

  pdf.save("finguard-preprocessing-report.pdf");
}

export default function UploadPanel({
  user,
  goAlerts,
  initialResult = null,
  onResult,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialResult);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const input = useRef(null);

  async function run(rows, name, baseProgress = 0) {
    setBusy(true);
    setError("");
    setResult(null);
    onResult?.(null);

    setProgress(baseProgress);
    setStatus("Preparing transaction data...");

    try {
      const output = await processRows(
        rows,
        user,
        name,
        ({ percent, message }) => {
          // When a CSV file has already been read, continue
          // from the file-reading progress instead of going backwards.
          const mappedProgress =
            baseProgress +
            ((100 - baseProgress) * percent) / 100;

          setProgress(Math.min(100, Math.round(mappedProgress)));
          setStatus(message || "Processing transactions...");
        }
      );

      setResult(output);
      onResult?.(output);

      setProgress(100);
      setStatus("Processing complete!");
    } catch (e) {
      setError(
        e?.message || "Unable to process the dataset."
      );

      setStatus("Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file.");
      setStatus("");
      setProgress(0);
      return;
    }

    setError("");
    setResult(null);
    onResult?.(null);

    setProgress(0);
    setStatus("Reading CSV file...");
    setBusy(true);

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round(
          (event.loaded / event.total) * 60
        );

        setProgress(percentage);
      }
    };

    reader.onload = () => {
      setProgress(60);
      setStatus("Validating CSV data...");

      Papa.parse(reader.result, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: "greedy",

        complete: async (parsed) => {
          if (parsed.errors?.length) {
            setError(
              `CSV parsing found ${parsed.errors.length} issue(s). ` +
                `First issue: ${parsed.errors[0].message}.`
            );

            setStatus("CSV validation failed.");
            setBusy(false);
            setProgress(0);
            return;
          }

          if (!parsed.data?.length) {
            setError(
              "The CSV file contains no transaction rows."
            );

            setStatus("No data found.");
            setBusy(false);
            setProgress(0);
            return;
          }

          // The file is read. Continue the progress bar from 60%.
          await run(parsed.data, file.name, 60);
        },

        error: (parseError) => {
          setError(
            parseError?.message ||
              "Unable to read the CSV file."
          );

          setStatus("CSV reading failed.");
          setBusy(false);
          setProgress(0);
        },
      });
    };

    reader.onerror = () => {
      setError("Unable to read the selected file.");
      setStatus("File reading failed.");
      setBusy(false);
      setProgress(0);
    };

    reader.readAsText(file);
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
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
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

        {(busy || progress === 100) && status && (
          <div className="mt-5 space-y-2" role="status">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{status}</span>

              <span className="font-bold tabular-nums">
                {progress}%
              </span>
            </div>

            <div
              className="h-4 w-full overflow-hidden rounded-full border border-black bg-white p-0.5"
              role="progressbar"
              aria-label="File processing progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 break-words text-sm text-critical"
          >
            Upload failed: {error}
          </p>
        )}
      </Panel>

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
                  Download PDF report
                </button>
              }
            >
              <div className="mb-5 rounded-lg border border-line p-4">
                <p className="text-sm text-muted">
                  Data-quality score
                </p>

                <p className="text-3xl font-bold">
                  {prep.dataQualityScore ?? "N/A"}
                  {prep.dataQualityScore != null ? "/100" : ""}
                </p>

                <p className="mt-1 text-xs text-muted">
                  This is a data-quality indicator, not a fraud
                  probability.
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
                  Duplicate policy: {prep.duplicatePolicy || "Not specified"}.
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
                            {(sample.reasons || []).map(
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
