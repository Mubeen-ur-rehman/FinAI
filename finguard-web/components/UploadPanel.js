
"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

import { processRows, generateDemoRows } from "@/lib/pipeline";
import { API_URL } from "@/lib/scoring";

import {
  Panel,
  btnGhost,
  btnPrimary,
  money,
  num,
} from "./ui";

const API_BASE = (API_URL || "").replace(/\/+$/, "");

const FIELD_DEFINITIONS = [
  { key: "amount", label: "Transaction amount", required: true },
  { key: "transaction_type", label: "Transaction type", required: true },
  { key: "sender_id", label: "Sender account", required: false },
  { key: "receiver_id", label: "Receiver account", required: false },
  { key: "old_balance", label: "Sender balance before", required: false },
  { key: "new_balance", label: "Sender balance after", required: false },
  { key: "old_destination_balance", label: "Receiver balance before", required: false },
  { key: "new_destination_balance", label: "Receiver balance after", required: false },
  { key: "timestamp", label: "Timestamp / step", required: false },
  { key: "fraud_label", label: "Fraud label (optional)", required: false },
];

const PIPELINE_FIELD_MAP = {
  amount: "amount",
  transaction_type: "type",
  sender_id: "nameOrig",
  receiver_id: "nameDest",
  old_balance: "oldbalanceOrg",
  new_balance: "newbalanceOrig",
  old_destination_balance: "oldbalanceDest",
  new_destination_balance: "newbalanceDest",
  timestamp: "step",
  fraud_label: "isFraud",
};

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
        <p className="text-sm text-muted">No issues detected.</p>
      )}
    </div>
  );
}

async function apiRequest(path, options = {}) {
  if (!API_BASE) {
    throw new Error(
      "FastAPI URL is not configured. Add NEXT_PUBLIC_API_URL to your .env.local file."
    );
  }

  const response = await fetch(`${API_BASE}${path}`, options);

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : data?.detail?.message;

    throw new Error(
      detail || `FastAPI request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: "greedy",

      complete: (parsed) => {
        if (parsed.errors?.length) {
          reject(
            new Error(
              `CSV parsing found an issue: ${parsed.errors[0].message}`
            )
          );
          return;
        }

        if (!parsed.data?.length) {
          reject(new Error("The CSV file contains no transaction rows."));
          return;
        }

        resolve(parsed.data);
      },

      error: (error) => {
        reject(new Error(error?.message || "Unable to read CSV file."));
      },
    });
  });
}

async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("The Excel file does not contain a worksheet.");
  }

  const worksheet = workbook.Sheets[firstSheet];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (!rows.length) {
    throw new Error("The Excel worksheet contains no transaction rows.");
  }

  return rows;
}

function normalizeDetectedMapping(detection, columns) {
  const result = {};
  const suggested = detection?.suggested_mapping || {};

  // The backend mapping direction is:
  // FinGuard standard field -> original uploaded column.
  Object.entries(suggested).forEach(([standardField, sourceColumn]) => {
    if (
      FIELD_DEFINITIONS.some((field) => field.key === standardField) &&
      columns.includes(sourceColumn)
    ) {
      result[standardField] = sourceColumn;
    }
  });

  // Support APIs that return suggestions as an array.
  if (Array.isArray(detection?.suggestions)) {
    detection.suggestions.forEach((suggestion) => {
      const standardField =
        suggestion.standard_field ||
        suggestion.field ||
        suggestion.target;

      const sourceColumn =
        suggestion.source_column ||
        suggestion.column ||
        suggestion.suggested_column;

      if (
        standardField &&
        sourceColumn &&
        FIELD_DEFINITIONS.some((field) => field.key === standardField) &&
        columns.includes(sourceColumn)
      ) {
        result[standardField] = sourceColumn;
      }
    });
  }

  return result;
}

function buildPipelineMapping(mapping, timestampKind) {
  const result = {};

  // The preprocessing function expects:
  // Original uploaded column -> FinGuard pipeline column.
  Object.entries(mapping).forEach(([standardField, sourceColumn]) => {
    if (!sourceColumn) return;

    if (
      standardField === "timestamp" &&
      timestampKind &&
      timestampKind !== "numeric_step"
    ) {
      return;
    }

    const pipelineField = PIPELINE_FIELD_MAP[standardField];

    if (pipelineField) {
      result[sourceColumn] = pipelineField;
    }
  });

  return result;
}

function downloadPreprocessingReport(result) {
  if (!result) {
    alert("No preprocessing report is available yet.");
    return;
  }

  const prep = result.preprocessing || {};
  const pdf = new jsPDF();

  const margin = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
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
    const content = `${label}: ${value ?? "N/A"}`;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const lines = pdf.splitTextToSize(content, maxWidth);

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
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 10;

  addHeading("Upload Information");
  addText("File name", result.fileName);
  addText("Batch ID", result.batchId);
  addText("Dataset ID", result.datasetId);
  addText("Scoring mode", result.mode);

  addHeading("Scan Summary");
  addText("Rows scored", result.scanned);
  addText("Alerts saved", result.alertCount);
  addText("Scoring time (ms)", result.scoringMs);
  addText("Amount at risk", result.amountAtRisk);

  addHeading("Data Quality");
  addText("Original rows", prep.originalRows);
  addText("Valid rows", prep.validRows);
  addText("Rejected rows", prep.rejectedRows);
  addText("Empty rows", prep.emptyRows);
  addText("Duplicate rows", prep.duplicateRows);
  addText("Data quality score", prep.qualityScore);

  addHeading("Preprocessing Notes");

  if (prep.notes?.length) {
    prep.notes.forEach((note, index) => {
      addText(`Note ${index + 1}`, note);
    });
  } else {
    addText("Notes", "No additional notes.");
  }

  addHeading("Sample Validation Issues");

  if (prep.rejectedSamples?.length) {
    prep.rejectedSamples.forEach((sample) => {
      addText("Row", sample.rowNumber);

      (sample.reasons || []).forEach((reason) => {
        addText("Issue", reason);
      });
    });
  } else {
    addText("Validation issues", "No rejected samples available.");
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

  const [fileName, setFileName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [columns, setColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [detection, setDetection] = useState(null);
  const [validation, setValidation] = useState(null);

  const [rawRows, setRawRows] = useState([]);
  const input = useRef(null);

  function updateResult(value) {
    setResult(value);
    onResult?.(value);
  }

  function updateProgress(value, message) {
    setProgress(Math.min(100, Math.max(0, Math.round(value))));
    setStatus(message || "");
  }

  async function handleFile(file) {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["csv", "xlsx"].includes(extension)) {
      setError("Please choose a CSV or XLSX file.");
      return;
    }

    setBusy(true);
    setError("");
    updateResult(null);

    setFileName(file.name);
    setDatasetId("");
    setColumns([]);
    setPreviewRows([]);
    setMapping({});
    setDetection(null);
    setValidation(null);
    setRawRows([]);

    updateProgress(5, "Reading your file...");

    try {
      const rows =
        extension === "csv"
          ? await parseCsvFile(file)
          : await parseExcelFile(file);

      if (!rows.length) {
        throw new Error("No transaction rows were found in the file.");
      }

      const sourceColumns = Object.keys(rows[0] || {});

      if (!sourceColumns.length) {
        throw new Error("The file does not contain column headers.");
      }

      setRawRows(rows);
      setColumns(sourceColumns);
      setPreviewRows(rows.slice(0, 5));

      updateProgress(20, "Uploading original file to FinGuard API...");

      const formData = new FormData();
      formData.append("file", file);

      const uploaded = await apiRequest("/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploaded?.dataset_id) {
        throw new Error("The API did not return a dataset ID.");
      }

      setDatasetId(uploaded.dataset_id);

      updateProgress(45, "Detecting your column names...");

      const detected = await apiRequest(
        `/detect-columns/${encodeURIComponent(uploaded.dataset_id)}?min_confidence=0.6`,
        { method: "POST" }
      );

      const suggestedMapping = normalizeDetectedMapping(
        detected,
        sourceColumns
      );

      setDetection(detected);
      setMapping(suggestedMapping);

      updateProgress(100, "File uploaded. Review and confirm the mapping.");

    } catch (e) {
      setError(e?.message || "Unable to upload or detect columns.");
      updateProgress(0, "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function changeMapping(standardField, sourceColumn) {
    setMapping((previous) => ({
      ...previous,
      [standardField]: sourceColumn,
    }));

    setValidation(null);
  }

  async function validateAndScore() {
    if (!datasetId) {
      setError("Upload a file before validating transactions.");
      return;
    }

    if (!rawRows.length) {
      setError("The uploaded transaction rows are not available.");
      return;
    }

    if (!mapping.amount || !mapping.transaction_type) {
      setError(
        "Please map both Transaction amount and Transaction type before scoring."
      );
      return;
    }

    setBusy(true);
    setError("");
    updateResult(null);

    try {
      updateProgress(10, "Confirming your column mapping...");

      await apiRequest(
        `/confirm-mapping/${encodeURIComponent(datasetId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mapping }),
        }
      );

      updateProgress(30, "Validating transaction data...");

      const validationResult = await apiRequest(
        `/validate/${encodeURIComponent(datasetId)}`,
        { method: "POST" }
      );

      setValidation(validationResult);

      if (
        validationResult?.ready_for_scoring === false ||
        validationResult?.status === "error" ||
        validationResult?.status === "invalid"
      ) {
        const messages = Array.isArray(validationResult.errors)
          ? validationResult.errors
              .map((item) =>
                typeof item === "string" ? item : item.message || JSON.stringify(item)
              )
              .join(" ")
          : "";

        throw new Error(
          messages || "The backend validation did not approve this dataset for scoring."
        );
      }

      updateProgress(45, "Preparing mapped transaction rows...");

      const preprocessingMapping = buildPipelineMapping(
        mapping,
        validationResult.timestamp_kind
      );

      updateProgress(55, "Scoring transactions with FinGuard...");

      const output = await processRows(
        rawRows,
        user,
        fileName,
        ({ percent, message }) => {
          const mappedProgress = 55 + (percent * 45) / 100;
          updateProgress(
            mappedProgress,
            message || "Scoring transactions..."
          );
        },
        {
          mapping: preprocessingMapping,
          datasetId,
          requiredColumns: ["amount", "type"],
        }
      );

      const completedOutput = {
        ...output,
        datasetId,
        fileName,
        validation: validationResult,
      };

      updateResult(completedOutput);
      updateProgress(100, "Processing complete!");
    } catch (e) {
      setError(e?.message || "Unable to validate or score transactions.");
      setStatus("Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runDemo() {
    setError("");
    setDetection(null);
    setValidation(null);
    setDatasetId("");
    setColumns([]);
    setPreviewRows([]);
    setMapping({});
    setRawRows([]);
    setFileName("demo-data-generated.csv");

    setBusy(true);
    updateResult(null);
    updateProgress(5, "Preparing demo transactions...");

    try {
      const rows = generateDemoRows(100);

      const output = await processRows(
        rows,
        user,
        "demo-data-generated.csv",
        ({ percent, message }) => {
          updateProgress(
            percent,
            message || "Scoring demo transactions..."
          );
        }
      );

      updateResult(output);
      updateProgress(100, "Demo processing complete!");
    } catch (e) {
      setError(
        e?.message ||
          "Demo scoring failed. Check that your FastAPI models are available."
      );
      setStatus("Demo processing failed.");
    } finally {
      setBusy(false);
    }
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
            drag ? "border-accent bg-accent/5" : "border-line"
          }`}
        >
          <p className="mb-1 font-semibold">
            Drop a CSV or XLSX file here
          </p>

          <p className="mb-4 text-sm text-muted">
            Upload a transaction file with your own column names.
            FinGuard will detect and help you map the columns.
          </p>

          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx"
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
              Choose CSV/XLSX file
            </button>

            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={runDemo}
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
            {error}
          </p>
        )}
      </Panel>

      {datasetId && (
        <Panel title="Column mapping">
          <p className="mb-4 text-sm text-muted">
            FinGuard has detected your columns. Review the suggested
            matches below. Select the original file column that
            corresponds to each FinGuard field.
          </p>

          <div className="mb-4 rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">{fileName}</p>
            <p className="mt-1 text-xs text-muted">
              {num(rawRows.length)} transaction rows · {columns.length} columns
            </p>
          </div>

          <div className="space-y-4">
            {FIELD_DEFINITIONS.map((field) => {
              const confidence =
                detection?.suggestions?.[field.key]?.confidence;

              return (
                <div
                  key={field.key}
                  className="grid gap-2 border-b border-line pb-3 sm:grid-cols-2 sm:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {field.label}
                      {field.required && (
                        <span className="ml-1 text-critical">*</span>
                      )}
                    </p>

                    <p className="text-xs text-muted">
                      {field.required
                        ? "Required for scoring"
                        : "Optional field"}
                    </p>
                  </div>

                  <select
                    value={mapping[field.key] || ""}
                    onChange={(event) =>
                      changeMapping(field.key, event.target.value)
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Not mapped</option>

                    {columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">
              Required mapping
            </p>
            <p className="mt-1 text-sm text-muted">
              Transaction amount and transaction type must be mapped.
              Other fields are optional, depending on the dataset and
              model requirements.
            </p>
          </div>

          {detection?.unmapped_columns?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">
                Unmapped source columns
              </p>
              <p className="mt-1 break-words text-sm text-muted">
                {detection.unmapped_columns.join(", ")}
              </p>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold">
                Data preview
              </h3>

              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line">
                      {columns.slice(0, 8).map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap px-3 py-2 font-semibold"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-line last:border-0"
                      >
                        {columns.slice(0, 8).map((column) => (
                          <td
                            key={column}
                            className="whitespace-nowrap px-3 py-2"
                          >
                            {String(row[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {columns.length > 8 && (
                <p className="mt-2 text-xs text-muted">
                  Showing the first 8 of {columns.length} columns.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !mapping.amount || !mapping.transaction_type}
              onClick={validateAndScore}
            >
              Validate and score transactions
            </button>
          </div>

          {validation && (
            <div className="mt-4 rounded-lg border border-line p-3">
              <p className="font-semibold">
                Backend validation result
              </p>
              <p className="mt-1 text-sm text-muted">
                Status: {validation.status || "Completed"}
              </p>
              <p className="text-sm text-muted">
                Ready for scoring:{" "}
                {validation.ready_for_scoring ? "Yes" : "No"}
              </p>

              {validation.errors?.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-critical">
                  {validation.errors.map((item, index) => (
                    <li key={index}>
                      {typeof item === "string"
                        ? item
                        : item.message || JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              )}

              {validation.warnings?.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {validation.warnings.map((item, index) => (
                    <li key={index}>
                      {typeof item === "string"
                        ? item
                        : item.message || JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      )}

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
              <Metric label="Rows scored" value={result.scanned} />
              <Metric label="Alerts saved" value={result.alertCount} />

              <div>
                <dt className="text-muted">Amount at risk</dt>
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
                  onClick={() => downloadPreprocessingReport(result)}
                >
                  Download PDF report
                </button>
              }
            >
              <div className="mb-5 rounded-lg border border-line p-4">
                <p className="text-sm text-muted">Data quality score</p>
                <p className="text-3xl font-bold">
                  {prep.qualityScore ?? prep.dataQualityScore ?? "N/A"}
                  {(prep.qualityScore ?? prep.dataQualityScore) != null
                    ? "/100"
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  This is a data-quality indicator, not a fraud probability.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <Metric label="Original rows" value={prep.originalRows} />
                <Metric label="Empty rows" value={prep.emptyRows ?? prep.emptyRowsRemoved} />
                <Metric label="Valid rows" value={prep.validRows} />
                <Metric label="Rejected rows" value={prep.rejectedRows} />
                <Metric label="Duplicate rows" value={prep.duplicateRows ?? prep.exactDuplicateRows} />
                <Metric label="Malformed rows" value={prep.malformedRows} />
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

                {prep.notes?.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">Preprocessing notes</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                      {prep.notes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted">
                  Duplicate policy: {prep.duplicatePolicy || "Not specified"}.
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
                            Row {sample.rowNumber}
                          </p>

                          <ul className="list-disc pl-5 text-muted">
                            {(sample.reasons || []).map((reason, index) => (
                              <li key={`${sample.rowNumber}-${index}`}>
                                {reason}
                              </li>
                            ))}
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
