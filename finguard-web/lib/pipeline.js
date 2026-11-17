
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";
import { FRAUD_TYPES, scoreRows } from "./scoring";
import { preprocessRows } from "./preprocessing";

const MAX_ALERTS_STORED = 500;
const SCORING_CHUNK_SIZE = 500;
const FIRESTORE_WRITE_CHUNK_SIZE = 400;

function throwStageError(stage, error) {
  console.error(`[FinGuard AI] ${stage} failed:`, {
    code: error?.code || "unknown",
    message: error?.message || String(error),
  });

  const code = error?.code ? ` (${error.code})` : "";
  const message = error?.message || String(error);

  throw new Error(`${stage}${code}: ${message}`);
}

function reportProgress(onProgress, percent, message) {
  if (typeof onProgress !== "function") return;

  try {
    onProgress({
      percent: Math.max(0, Math.min(100, percent)),
      message,
    });
  } catch (error) {
    console.warn(
      "[FinGuard AI] Progress callback failed:",
      error
    );
  }
}

function countRiskLevels(rows) {
  const counts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const row of rows) {
    const level = row.risk_level;

    if (Object.hasOwn(counts, level)) {
      counts[level] += 1;
    }
  }

  return counts;
}

export async function processRows(
  rawRows,
  user,
  fileName = "upload.csv",
  onProgress,
  options = {}
) {
  const {
    mapping = null,
    datasetId = null,
    requiredColumns = ["amount", "type"],
  } = options;

  if (!user?.uid) {
    throw new Error(
      "Please sign in before uploading transaction data."
    );
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("The file has no rows.");
  }

  console.log("[FinGuard AI] Processing started:", {
    uid: user.uid,
    fileName,
    inputRows: rawRows.length,
    datasetId,
  });

  reportProgress(
    onProgress,
    5,
    "Validating transaction data…"
  );

  // Stage 1: Preprocess and validate transaction data.
  let cleanRows;
  let report;

  try {
    const result = preprocessRows(rawRows, {
      mapping,
      requiredColumns,
    });

    cleanRows = result.rows;
    report = result.report;

    if (!Array.isArray(cleanRows) || !report) {
      throw new Error(
        "Preprocessing did not return rows and a report."
      );
    }
  } catch (error) {
    throwStageError("Data preprocessing", error);
  }

  reportProgress(
    onProgress,
    15,
    "Filtering supported transaction types…"
  );

  // Stage 2: Keep only supported transaction types.
  const supportedRows = cleanRows.filter((row) =>
    FRAUD_TYPES.includes(
      String(row.type || "").trim().toUpperCase()
    )
  );

  const unsupportedTypeRows =
    cleanRows.length - supportedRows.length;

  if (supportedRows.length === 0) {
    throw new Error(
      "No valid TRANSFER or CASH_OUT rows were found."
    );
  }

  console.log("[FinGuard AI] Preprocessing completed:", {
    inputRows: rawRows.length,
    validRows: cleanRows.length,
    supportedRows: supportedRows.length,
    unsupportedTypeRows,
  });

  reportProgress(
    onProgress,
    20,
    `Scoring ${supportedRows.length.toLocaleString()} transactions…`
  );

  // Stage 3: Score transactions in chunks.
  const startedAt = performance.now();
  const scored = [];
  const modes = new Set();

  const totalScoringChunks = Math.ceil(
    supportedRows.length / SCORING_CHUNK_SIZE
  );

  try {
    for (
      let start = 0, chunkIndex = 0;
      start < supportedRows.length;
      start += SCORING_CHUNK_SIZE, chunkIndex++
    ) {
      const chunk = supportedRows.slice(
        start,
        start + SCORING_CHUNK_SIZE
      );

      // Real API scoring only. Demo fallback is not enabled.
      const result = await scoreRows(chunk);

      if (!Array.isArray(result?.scored)) {
        throw new Error(
          "The scoring function returned an invalid result."
        );
      }

      if (result.scored.length !== chunk.length) {
        throw new Error(
          "The scoring result count does not match the input count."
        );
      }

      scored.push(...result.scored);
      modes.add(result.mode);

      const scoringProgress =
        20 +
        Math.round(
          ((chunkIndex + 1) / totalScoringChunks) * 45
        );

      reportProgress(
        onProgress,
        scoringProgress,
        `Scoring transactions: ${Math.min(
          start + chunk.length,
          supportedRows.length
        ).toLocaleString()} of ${supportedRows.length.toLocaleString()}`
      );
    }
  } catch (error) {
    throwStageError("Transaction scoring", error);
  }

  const scoringMs = Math.round(
    performance.now() - startedAt
  );

  const mode =
    modes.size === 1 ? [...modes][0] : "mixed";

  // Stage 4: Calculate risk distribution.
  const counts = countRiskLevels(scored);

  // Stage 5: Identify all qualifying alerts.
  const qualifyingAlerts = scored
    .filter(
      (row) =>
        Number.isFinite(Number(row.risk_score)) &&
        Number(row.risk_score) >= 40
    )
    .sort(
      (a, b) =>
        Number(b.risk_score) - Number(a.risk_score)
    );

  const alerts = qualifyingAlerts.slice(
    0,
    MAX_ALERTS_STORED
  );

  const amountAtRisk = qualifyingAlerts.reduce(
    (sum, row) =>
      sum + (Number(row.amount) || 0),
    0
  );

  const alertCount = qualifyingAlerts.length;
  const storedAlertCount = alerts.length;

  reportProgress(
    onProgress,
    68,
    "Preparing preprocessing report and upload summary…"
  );

  // Stage 6: Prepare preprocessing summary.
  const preprocessingSummary = {
    originalRows: report.originalRows ?? 0,
    emptyRowsRemoved: report.emptyRowsRemoved ?? 0,
    validRows: report.validRows ?? 0,
    rejectedRows: report.rejectedRows ?? 0,
    exactDuplicateRows: report.exactDuplicateRows ?? 0,
    dataQualityScore: report.dataQualityScore ?? 0,
    unsupportedTypeRows,
    rowsScored: scored.length,
    missingValues: report.missingValues ?? {},
    invalidNumericValues: report.invalidNumericValues ?? {},
    negativeValues: report.negativeValues ?? {},
    duplicatePolicy: report.duplicatePolicy ?? "Not specified",
    rejectedSamples: report.rejectedSamples ?? [],
    mappedColumns: report.mappedColumns ?? [],
  };

  // Stage 7: Save batch information.
  let batchRef;

  try {
    reportProgress(
      onProgress,
      72,
      "Saving upload history…"
    );

    batchRef = await addDoc(
      collection(db, "batches"),
      {
        fileName,
        datasetId,

        scanned: scored.length,
        alertCount,
        storedAlertCount,

        counts,
        amountAtRisk,

        scoringMs,
        mode,
        preprocessing: preprocessingSummary,
        uploadedBy: user.email || "",
        uploadedByUid: user.uid,
        createdAt: serverTimestamp(),
      }
    );

    console.log("[FinGuard AI] Batch saved:", {
      batchId: batchRef.id,
      datasetId,
      scanned: scored.length,
      alertCount,
      storedAlertCount,
      amountAtRisk,
    });
  } catch (error) {
    throwStageError("Saving upload batch", error);
  }

  // Stage 8: Save alerts with the correct batch ID.
  try {
    const totalWriteChunks = Math.max(
      1,
      Math.ceil(
        alerts.length / FIRESTORE_WRITE_CHUNK_SIZE
      )
    );

    for (
      let i = 0, chunkIndex = 0;
      i < alerts.length;
      i += FIRESTORE_WRITE_CHUNK_SIZE, chunkIndex++
    ) {
      const writeGroup = writeBatch(db);

      const alertChunk = alerts.slice(
        i,
        i + FIRESTORE_WRITE_CHUNK_SIZE
      );

      for (const row of alertChunk) {
        const alertRef = doc(
          collection(db, "alerts")
        );

        writeGroup.set(alertRef, {
          step: row.step ?? null,
          type: row.type ?? "",
          amount: row.amount,

          nameOrig: String(row.nameOrig ?? ""),
          nameDest: String(row.nameDest ?? ""),

          oldbalanceOrg: row.oldbalanceOrg ?? null,
          newbalanceOrig: row.newbalanceOrig ?? null,
          oldbalanceDest: row.oldbalanceDest ?? null,
          newbalanceDest: row.newbalanceDest ?? null,

          fraud_prob: row.fraud_prob ?? null,
          anomaly_score: row.anomaly_score ?? null,

          risk_score: Number(row.risk_score),
          risk_level: row.risk_level ?? "Low",

          status: "open",
          batchId: batchRef.id,
          datasetId,

          uploadedBy: user.email || "",
          uploadedByUid: user.uid,

          createdAt: serverTimestamp(),
        });
      }

      await writeGroup.commit();

      const writeProgress =
        75 +
        Math.round(
          ((chunkIndex + 1) / totalWriteChunks) * 23
        );

      reportProgress(
        onProgress,
        writeProgress,
        `Saving alerts: ${Math.min(
          i + alertChunk.length,
          alerts.length
        ).toLocaleString()} of ${alerts.length.toLocaleString()}`
      );

      console.log("[FinGuard AI] Alerts saved:", {
        batchId: batchRef.id,
        savedInThisGroup: alertChunk.length,
      });
    }

    if (alerts.length === 0) {
      reportProgress(
        onProgress,
        98,
        "No alerts met the storage threshold. Finalizing report…"
      );
    }
  } catch (error) {
    throwStageError(
      `Saving alerts for batch ${batchRef.id}`,
      error
    );
  }

  console.log("[FinGuard AI] Processing completed:", {
    batchId: batchRef.id,
    datasetId,
    scanned: scored.length,
    alertCount,
    storedAlertCount,
    amountAtRisk,
    uid: user.uid,
  });

  reportProgress(
    onProgress,
    100,
    "Processing complete"
  );

  return {
    batchId: batchRef.id,
    datasetId,
    fileName,
    scanned: scored.length,
    alertCount,
    storedAlertCount,
    counts,
    amountAtRisk,
    scoringMs,
    mode,
    preprocessing: {
      ...preprocessingSummary,
    },
  };
}

// Synthetic demo-data generator.
export function generateDemoRows(n = 2000, frauds = 30) {
  const rnd = (a, b) =>
    a + Math.random() * (b - a);

  const pick = (arr) =>
    arr[Math.floor(Math.random() * arr.length)];

  const mules = [
    "C900000001",
    "C900000002",
    "C900000003",
  ];

  const rows = [];

  const totalRows = Math.max(
    0,
    Math.floor(Number(n) || 0)
  );

  const fraudCount = Math.min(
    totalRows,
    Math.max(0, Math.floor(Number(frauds) || 0))
  );

  for (let i = 0; i < totalRows; i++) {
    const isFraud = i < fraudCount;
    const type = pick(FRAUD_TYPES);
    const step = Math.floor(rnd(1, 300));

    if (isFraud) {
      const amount = Math.round(
        rnd(80000, 900000)
      );

      rows.push({
        step,
        type,
        amount,
        nameOrig: `C${Math.floor(rnd(1e8, 9e8))}`,
        oldbalanceOrg: amount,
        newbalanceOrig: 0,
        nameDest: pick(mules),
        oldbalanceDest: 0,
        newbalanceDest: 0,
      });
    } else {
      const oldO = Math.round(
        rnd(5000, 400000)
      );

      const amount = Math.round(
        rnd(
          100,
          Math.max(
            101,
            Math.min(oldO * 0.6, 120000)
          )
        )
      );

      const oldD = Math.round(
        rnd(0, 800000)
      );

      rows.push({
        step,
        type,
        amount,
        nameOrig: `C${Math.floor(rnd(1e8, 9e8))}`,
        oldbalanceOrg: oldO,
        newbalanceOrig: oldO - amount,
        nameDest: `C${Math.floor(rnd(1e8, 9e8))}`,
        oldbalanceDest: oldD,
        newbalanceDest: oldD + amount,
      });
    }
  }

  return rows.sort(
    () => Math.random() - 0.5
  );
}
