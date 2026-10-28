
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";
import { FRAUD_TYPES, REQUIRED_COLUMNS, scoreRows } from "./scoring";
import { preprocessRows } from "./preprocessing";

const MAX_ALERTS_STORED = 500;
const SCORING_CHUNK_SIZE = 500;

export function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("The file has no rows.");
  }

  const columns = Object.keys(rows[0]).map((column) =>
    column.trim()
  );

  const missing = REQUIRED_COLUMNS.filter(
    (column) => !columns.includes(column)
  );

  if (missing.length) {
    throw new Error(`Missing columns: ${missing.join(", ")}`);
  }
}

export async function processRows(
  rawRows,
  user,
  fileName = "upload.csv"
) {
  // Ensure an authenticated user is available.
  if (!user?.uid) {
    throw new Error("Please sign in before uploading transaction data.");
  }

  // Stage 1: validate and preprocess the uploaded data.
  const { rows: cleanRows, report } = preprocessRows(rawRows);

  // Stage 2: keep transaction types supported by the current scorer.
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

  // Stage 3: score transactions in manageable sequential chunks.
  const startedAt = performance.now();
  const scored = [];
  const modes = new Set();

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

    scored.push(...result.scored);
    modes.add(result.mode);
  }

  const scoringMs = Math.round(
    performance.now() - startedAt
  );

  const mode =
    modes.size === 1 ? [...modes][0] : "mixed";

  // Stage 4: summarize risk levels.
  const counts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const row of scored) {
    counts[row.risk_level] =
      (counts[row.risk_level] || 0) + 1;
  }

  // Preserve the existing alert threshold and storage limit.
  const alerts = scored
    .filter((row) => row.risk_score >= 40)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, MAX_ALERTS_STORED);

  const amountAtRisk = alerts.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  // Stage 5: store a preprocessing audit summary with the batch.
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

  // Save batch with the authenticated user's UID.
  const batchRef = await addDoc(
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

  // Stage 6: save alerts in safe Firestore write batches.
  // Each alert is associated with the same authenticated user.
  for (let i = 0; i < alerts.length; i += 400) {
    const writeGroup = writeBatch(db);

    alerts.slice(i, i + 400).forEach((row) => {
      writeGroup.set(doc(collection(db, "alerts")), {
        step: row.step,
        type: row.type,
        amount: row.amount,
        nameOrig: String(row.nameOrig),
        nameDest: String(row.nameDest),
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
    });

    await writeGroup.commit();
  }

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

// Existing synthetic demo-data generator.
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
        rnd(100, Math.max(101, Math.min(oldO * 0.6, 120000)))
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
