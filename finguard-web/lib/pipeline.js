
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

export async function processRows(
  rawRows,
  user,
  fileName = "upload.csv"
) {
  if (!user?.uid) {
    throw new Error(
      "Please sign in before uploading transaction data."
    );
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("The file has no rows.");
  }

  console.log("[FinGuard AI] Upload started:", {
    uid: user.uid,
    fileName,
    inputRows: rawRows.length,
  });

  // Stage 1: preprocess and validate transaction data.
  let cleanRows;
  let report;

  try {
    const result = preprocessRows(rawRows);
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

  // Stage 2: keep only transaction types supported by the scorer.
  const supportedRows = cleanRows.filter((row) =>
    FRAUD_TYPES.includes(row.type)
  );

  const unsupportedTypeRows =
    cleanRows.length - supportedRows.length;

  if (supportedRows.length === 0) {
    throw new Error(
      "No valid TRANSFER or CASH_OUT rows were found."
    );
  }

  // Stage 3: score transactions in manageable chunks.
  const startedAt = performance.now();
  const scored = [];
  const modes = new Set();

  try {
    for (
      let start = 0;
      start < supportedRows.length;
      start += SCORING_CHUNK_SIZE
    ) {
      const chunk = supportedRows.slice(
        start,
        start + SCORING_CHUNK_SIZE
      );

      const result = await scoreRows(chunk);

      if (!Array.isArray(result?.scored)) {
        throw new Error(
          "The scoring function returned an invalid result."
        );
      }

      scored.push(...result.scored);
      modes.add(result.mode || "demo");
    }
  } catch (error) {
    throwStageError("Transaction scoring", error);
  }

  const scoringMs = Math.round(
    performance.now() - startedAt
  );

  const mode =
    modes.size === 1 ? [...modes][0] : "mixed";

  // Stage 4: calculate risk-level counts.
  const counts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const row of scored) {
    if (Object.hasOwn(counts, row.risk_level)) {
      counts[row.risk_level] += 1;
    }
  }

  // Preserve the existing alert threshold and maximum.
  const alerts = scored
    .filter(
      (row) =>
        Number.isFinite(Number(row.risk_score)) &&
        Number(row.risk_score) >= 40
    )
    .sort(
      (a, b) =>
        Number(b.risk_score) - Number(a.risk_score)
    )
    .slice(0, MAX_ALERTS_STORED);

  const amountAtRisk = alerts.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );

  // Stage 5: prepare the preprocessing summary.
  const preprocessingSummary = {
    originalRows: report.originalRows,
    emptyRowsRemoved: report.emptyRowsRemoved,
    validRows: report.validRows,
    rejectedRows: report.rejectedRows,
    exactDuplicateRows: report.exactDuplicateRows,
    dataQualityScore: report.dataQualityScore,
    unsupportedTypeRows,
    rowsScored: scored.length,
    missingValues: report.missingValues,
    invalidNumericValues: report.invalidNumericValues,
    negativeValues: report.negativeValues,
    duplicatePolicy: report.duplicatePolicy,
  };

  // Stage 6: save the batch under the authenticated user's UID.
  let batchRef;

  try {
    batchRef = await addDoc(
      collection(db, "batches"),
      {
        fileName,
        scanned: scored.length,
        alertCount: alerts.length,
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

    console.log("[FinGuard AI] Batch saved:", batchRef.id);
  } catch (error) {
    throwStageError("Saving upload batch", error);
  }

  // Stage 7: save alerts in chunks below Firestore's write limit.
  try {
    for (
      let i = 0;
      i < alerts.length;
      i += FIRESTORE_WRITE_CHUNK_SIZE
    ) {
      const writeGroup = writeBatch(db);
      const alertChunk = alerts.slice(
        i,
        i + FIRESTORE_WRITE_CHUNK_SIZE
      );

      for (const row of alertChunk) {
        const alertRef = doc(collection(db, "alerts"));

        writeGroup.set(alertRef, {
          step: row.step,
          type: row.type,
          amount: row.amount,
          nameOrig: String(row.nameOrig ?? ""),
          nameDest: String(row.nameDest ?? ""),
          oldbalanceOrg: row.oldbalanceOrg,
          newbalanceOrig: row.newbalanceOrig,
          oldbalanceDest: row.oldbalanceDest,
          newbalanceDest: row.newbalanceDest,
          fraud_prob: row.fraud_prob,
          anomaly_score: row.anomaly_score,
          risk_score: row.risk_score,
          risk_level: row.risk_level,
          status: "open",
          batchId: batchRef.id,
          uploadedBy: user.email || "",
          uploadedByUid: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      await writeGroup.commit();

      console.log("[FinGuard AI] Alerts saved:", {
        batchId: batchRef.id,
        savedInThisGroup: alertChunk.length,
      });
    }
  } catch (error) {
    throwStageError(
      `Saving alerts for batch ${batchRef.id}`,
      error
    );
  }

  console.log("[FinGuard AI] Processing completed:", {
    batchId: batchRef.id,
    scanned: scored.length,
    alertCount: alerts.length,
    uid: user.uid,
  });

  return {
    scanned: scored.length,
    alertCount: alerts.length,
    counts,
    amountAtRisk,
    scoringMs,
    mode,
    preprocessing: {
      ...report,
      unsupportedTypeRows,
      rowsScored: scored.length,
    },
  };
}

// Synthetic demo-data generator.
export function generateDemoRows(n = 2000, frauds = 30) {
  const rnd = (a, b) => a + Math.random() * (b - a);

  const pick = (arr) =>
    arr[Math.floor(Math.random() * arr.length)];

  const mules = [
    "C900000001",
    "C900000002",
    "C900000003",
  ];

  const rows = [];

  for (let i = 0; i < n; i++) {
    const isFraud = i < frauds;
    const type = pick(FRAUD_TYPES);
    const step = Math.floor(rnd(1, 300));

    if (isFraud) {
      const amount = Math.round(rnd(80000, 900000));

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
      const oldO = Math.round(rnd(5000, 400000));

      const amount = Math.round(
        rnd(
          100,
          Math.max(101, Math.min(oldO * 0.6, 120000))
        )
      );

      const oldD = Math.round(rnd(0, 800000));

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

  return rows.sort(() => Math.random() - 0.5);
}
