// Risk scoring. Two modes:
//  1) NEXT_PUBLIC_API_URL set  -> sends rows to your FastAPI model (XGBoost + Isolation Forest)
//  2) not set / API down       -> built-in demo scorer (rule-based stand-in so the app works today)

export const FRAUD_TYPES = ["TRANSFER", "CASH_OUT"];
export const REQUIRED_COLUMNS = [
  "step", "type", "amount", "nameOrig", "oldbalanceOrg",
  "newbalanceOrig", "nameDest", "oldbalanceDest", "newbalanceDest",
];

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function riskLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function combineScore(fraudProb, anomaly) {
  return Math.round(100 * (0.85 * fraudProb + 0.15 * anomaly));
}

// Same engineered features as the Python pipeline (ml/features.py)
function features(r) {
  const amount = Number(r.amount) || 0;
  const oldO = Number(r.oldbalanceOrg) || 0;
  const newO = Number(r.newbalanceOrig) || 0;
  const oldD = Number(r.oldbalanceDest) || 0;
  const newD = Number(r.newbalanceDest) || 0;
  return {
    amount,
    errorOrig: newO + amount - oldO,
    errorDest: oldD + amount - newD,
    emptied: oldO > 0 && newO === 0,
    ratio: amount / (oldO + 1),
    destUntouched: oldD === 0 && newD === 0,
  };
}

function demoScore(r) {
  const f = features(r);
  let z = -6;
  if (f.emptied) z += 3;
  if (f.ratio >= 0.95) z += 1.5;
  if (f.destUntouched) z += 1.5;
  if (Math.abs(f.errorDest) > 0.5 * f.amount) z += 1;
  if (f.amount > 200000) z += 1;
  const fraud_prob = 1 / (1 + Math.exp(-z));
  const anomaly_score = Math.min(1, Math.log10(f.amount + 1) / 7);
  return { fraud_prob, anomaly_score };
}

async function apiScore(rows) {
  const res = await fetch(`${API_URL}/score-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return data.results; // [{fraud_prob, anomaly_score}, ...]
}

// Returns { scored: rows with risk fields, mode: "api" | "demo" }
export async function scoreRows(rows) {
  let results, mode = "demo";
  if (API_URL) {
    try {
      results = await apiScore(rows);
      mode = "api";
    } catch (e) {
      console.warn("API scoring failed, using demo scorer:", e.message);
    }
  }
  if (!results) results = rows.map(demoScore);

  const scored = rows.map((r, i) => {
    const { fraud_prob, anomaly_score } = results[i];
    const risk_score = combineScore(fraud_prob, anomaly_score);
    return { ...r, fraud_prob, anomaly_score, risk_score, risk_level: riskLevel(risk_score) };
  });
  return { scored, mode };
}
