
// Risk scoring modes:
// 1) NEXT_PUBLIC_API_URL is set: use FastAPI model.
// 2) API is unavailable or returns invalid data: use demo scorer.

export const FRAUD_TYPES = ["TRANSFER", "CASH_OUT"];

export const REQUIRED_COLUMNS = [
  "step",
  "type",
  "amount",
  "nameOrig",
  "oldbalanceOrg",
  "newbalanceOrig",
  "nameDest",
  "oldbalanceDest",
  "newbalanceDest",
];

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || ""
).trim().replace(/\/+$/, "");

export function riskLevel(score) {
  const value = Number(score);

  if (!Number.isFinite(value)) return "Low";
  if (value >= 80) return "Critical";
  if (value >= 60) return "High";
  if (value >= 40) return "Medium";

  return "Low";
}

export function combineScore(fraudProb, anomaly) {
  const fraud = Number(fraudProb);
  const anomalyValue = Number(anomaly);

  if (
    !Number.isFinite(fraud) ||
    !Number.isFinite(anomalyValue)
  ) {
    throw new Error("Invalid fraud or anomaly score.");
  }

  return Math.round(
    100 * (0.85 * fraud + 0.15 * anomalyValue)
  );
}

// Same engineered features as the Python pipeline (ml/features.py).
function features(row) {
  const amount = Number(row.amount) || 0;
  const oldO = Number(row.oldbalanceOrg) || 0;
  const newO = Number(row.newbalanceOrig) || 0;
  const oldD = Number(row.oldbalanceDest) || 0;
  const newD = Number(row.newbalanceDest) || 0;

  return {
    amount,
    errorOrig: newO + amount - oldO,
    errorDest: oldD + amount - newD,
    emptied: oldO > 0 && newO === 0,
    ratio: amount / (oldO + 1),
    destUntouched: oldD === 0 && newD === 0,
  };
}

// Built-in rule-based demo scorer.
function demoScore(row) {
  const f = features(row);

  let z = -6;

  if (f.emptied) z += 3;
  if (f.ratio >= 0.95) z += 1.5;
  if (f.destUntouched) z += 1.5;
  if (Math.abs(f.errorDest) > 0.5 * f.amount) z += 1;
  if (f.amount > 200000) z += 1;

  const fraud_prob = 1 / (1 + Math.exp(-z));

  const anomaly_score = Math.min(
    1,
    Math.log10(Math.max(0, f.amount) + 1) / 7
  );

  return {
    fraud_prob,
    anomaly_score,
  };
}

// Validate FastAPI results before using them.
function validateApiResults(results, expectedLength) {
  if (!Array.isArray(results)) {
    throw new Error(
      "API response does not contain a valid results array."
    );
  }

  if (results.length !== expectedLength) {
    throw new Error(
      `API returned ${results.length} results, but ${expectedLength} were expected.`
    );
  }

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    const fraudProb = Number(result?.fraud_prob);
    const anomalyScore = Number(result?.anomaly_score);

    if (
      !Number.isFinite(fraudProb) ||
      !Number.isFinite(anomalyScore)
    ) {
      throw new Error(
        `Invalid scoring values returned for transaction ${i + 1}.`
      );
    }

    if (
      fraudProb < 0 ||
      fraudProb > 1 ||
      anomalyScore < 0 ||
      anomalyScore > 1
    ) {
      throw new Error(
        `Scoring values must be between 0 and 1. Transaction: ${i + 1}.`
      );
    }
  }

  return results;
}

// Send a batch to the FastAPI scoring service.
async function apiScore(rows) {
  const response = await fetch(
    `${API_URL}/score-batch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `API returned HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  return validateApiResults(
    data?.results,
    rows.length
  );
}

// Returns:
// {
//   scored: rows with fraud_prob, anomaly_score,
//           risk_score and risk_level,
//   mode: "api" | "demo"
// }
export async function scoreRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "Scoring requires a non-empty array of transactions."
    );
  }

  let results = null;
  let mode = "demo";

  // Try the FastAPI model first when configured.
  if (API_URL) {
    try {
      results = await apiScore(rows);
      mode = "api";
    } catch (error) {
      console.warn(
        "[FinGuard AI] API scoring failed. Using demo scorer:",
        error?.message || error
      );
    }
  }

  // Use demo scoring if the API is unavailable or invalid.
  if (!results) {
    results = rows.map(demoScore);
    mode = "demo";
  }

  const scored = rows.map((row, index) => {
    const result = results[index];

    const fraud_prob = Number(result.fraud_prob);
    const anomaly_score = Number(result.anomaly_score);

    const risk_score = combineScore(
      fraud_prob,
      anomaly_score
    );

    return {
      ...row,
      fraud_prob,
      anomaly_score,
      risk_score,
      risk_level: riskLevel(risk_score),
    };
  });

  return {
    scored,
    mode,
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
