import {
  addDoc, collection, doc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { FRAUD_TYPES, REQUIRED_COLUMNS, scoreRows } from "./scoring";

const MAX_ALERTS_STORED = 500; // keeps you inside Firestore's free write quota

export function validateRows(rows) {
  if (!rows.length) throw new Error("The file has no rows.");
  const cols = Object.keys(rows[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
}

// rows -> score -> save summary + top alerts to Firestore
export async function processRows(rawRows, user, fileName = "upload.csv") {
  validateRows(rawRows);
  const rows = rawRows.filter((r) => FRAUD_TYPES.includes(r.type));
  if (!rows.length) throw new Error("No TRANSFER or CASH_OUT rows found.");

  const t0 = performance.now();
  const { scored, mode } = await scoreRows(rows);
  const scoringMs = Math.round(performance.now() - t0);

  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  scored.forEach((r) => counts[r.risk_level]++);

  const alerts = scored
    .filter((r) => r.risk_score >= 40)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, MAX_ALERTS_STORED);

  const amountAtRisk = alerts.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const batchRef = await addDoc(collection(db, "batches"), {
    fileName,
    scanned: scored.length,
    alertCount: alerts.length,
    counts,
    amountAtRisk,
    scoringMs,
    mode,
    uploadedBy: user.email,
    createdAt: serverTimestamp(),
  });

  // Firestore allows 500 writes per batch; use 400 to be safe.
  for (let i = 0; i < alerts.length; i += 400) {
    const wb = writeBatch(db);
    alerts.slice(i, i + 400).forEach((r) => {
      wb.set(doc(collection(db, "alerts")), {
        step: Number(r.step), type: r.type, amount: Number(r.amount),
        nameOrig: String(r.nameOrig), nameDest: String(r.nameDest),
        oldbalanceOrg: Number(r.oldbalanceOrg), newbalanceOrig: Number(r.newbalanceOrig),
        oldbalanceDest: Number(r.oldbalanceDest), newbalanceDest: Number(r.newbalanceDest),
        fraud_prob: r.fraud_prob, anomaly_score: r.anomaly_score,
        risk_score: r.risk_score, risk_level: r.risk_level,
        status: "open", batchId: batchRef.id, uploadedBy: user.email,
        createdAt: serverTimestamp(),
      });
    });
    await wb.commit();
  }

  return { scanned: scored.length, alertCount: alerts.length, counts, amountAtRisk, scoringMs, mode };
}

// Built-in demo data: ~2,000 rows, ~30 frauds, with a few mule accounts for the path map
export function generateDemoRows(n = 2000, frauds = 30) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const mules = ["C900000001", "C900000002", "C900000003"];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const isFraud = i < frauds;
    const type = pick(FRAUD_TYPES);
    const step = Math.floor(rnd(1, 300));
    if (isFraud) {
      const amount = Math.round(rnd(80000, 900000));
      rows.push({
        step, type, amount,
        nameOrig: `C${Math.floor(rnd(1e8, 9e8))}`, oldbalanceOrg: amount, newbalanceOrig: 0,
        nameDest: pick(mules), oldbalanceDest: 0, newbalanceDest: 0,
      });
    } else {
      const oldO = Math.round(rnd(5000, 400000));
      const amount = Math.round(rnd(100, Math.min(oldO * 0.6, 120000)));
      const oldD = Math.round(rnd(0, 800000));
      rows.push({
        step, type, amount,
        nameOrig: `C${Math.floor(rnd(1e8, 9e8))}`, oldbalanceOrg: oldO, newbalanceOrig: oldO - amount,
        nameDest: `C${Math.floor(rnd(1e8, 9e8))}`, oldbalanceDest: oldD, newbalanceDest: oldD + amount,
      });
    }
  }
  return rows.sort(() => Math.random() - 0.5);
}
