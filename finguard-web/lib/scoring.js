
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

const FRAUD_TYPES = ["TRANSFER", "CASH_OUT"];

const REQUIRED_COLUMNS = [
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

const RISK_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
};

function getRiskLevel(score) {
  const value = Number(score);

  if (!Number.isFinite(value)) return "Low";
  if (value >= RISK_THRESHOLDS.critical) return "Critical";
  if (value >= RISK_THRESHOLDS.high) return "High";
  if (value >= RISK_THRESHOLDS.medium) return "Medium";

  return "Low";
}

function combineScore(fraudProb, anomalyScore) {
  const fraud = Number(fraudProb);
  const anomaly = Number(anomalyScore);

  if (
    !Number.isFinite(fraud) ||
    !Number.isFinite(anomaly) ||
    fraud < 0 ||
    fraud > 1 ||
    anomaly < 0 ||
    anomaly > 1
  ) {
    throw new Error("Invalid model scores. Expected values between 0 and 1.");
  }

  return Math.round(100 * (0.85 * fraud + 0.15 * anomaly));
}

function validateModelResult(result, index) {
  const fraudProb = Number(result?.fraud_prob);
  const anomalyScore = Number(result?.anomaly_score);

  if (
    !Number.isFinite(fraudProb) ||
    !Number.isFinite(anomalyScore) ||
    fraudProb < 0 ||
    fraudProb > 1 ||
    anomalyScore < 0 ||
    anomalyScore > 1
  ) {
    throw new Error(
      `Invalid scoring result at row ${index + 1}. Expected fraud_prob and anomaly_score between 0 and 1.`
    );
  }

  const riskScore = combineScore(fraudProb, anomalyScore);

  return {
    fraud_prob: fraudProb,
    anomaly_score: anomalyScore,
    risk_score: riskScore,
    risk_level: getRiskLevel(riskScore),
  };
}

function scoreDemoRow(row) {
  const amount = Math.max(0, Number(row.amount) || 0);
  const oldBalance = Math.max(0, Number(row.oldbalanceOrg) || 0);
  const newBalance = Math.max(0, Number(row.newbalanceOrig) || 0);
  const type = String(row.type || "").toUpperCase();

  let fraudProb = 0.05;
  let anomalyScore = 0.05;

  if (type === "TRANSFER") {
    fraudProb += 0.25;
    anomalyScore += 0.15;
  }

  if (type === "CASH_OUT") {
    fraudProb += 0.2;
    anomalyScore += 0.2;
  }

  if (amount > 100000) {
    fraudProb += 0.2;
    anomalyScore += 0.2;
  } else if (amount > 50000) {
    fraudProb += 0.1;
    anomalyScore += 0.1;
  }

  if (oldBalance > 0 && amount > oldBalance) {
    fraudProb += 0.2;
    anomalyScore += 0.15;
  }

  if (oldBalance > 0 && newBalance === 0) {
    fraudProb += 0.1;
    anomalyScore += 0.1;
  }

  fraudProb = Math.min(0.99, fraudProb);
  anomalyScore = Math.min(0.99, anomalyScore);

  const riskScore = combineScore(fraudProb, anomalyScore);

  return {
    ...row,
    fraud_prob: fraudProb,
    anomaly_score: anomalyScore,
    risk_score: riskScore,
    risk_level: getRiskLevel(riskScore),
  };
}

async function scoreRows(rows, { allowDemoFallback = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new Error("Scoring input must be an array of transaction rows.");
  }

  if (rows.length === 0) {
    return {
      scored: [],
      mode: "api",
    };
  }

  if (!API_URL) {
    if (allowDemoFallback) {
      return {
        scored: rows.map(scoreDemoRow),
        mode: "demo",
      };
    }

    throw new Error(
      "FastAPI URL is not configured. Add NEXT_PUBLIC_API_URL to your .env.local file."
    );
  }

  try {
    const response = await fetch(`${API_URL}/score-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows }),
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("FastAPI returned an invalid JSON response.");
    }

    if (!response.ok) {
      const detail =
        typeof data?.detail === "string"
          ? data.detail
          : data?.detail?.message;

      throw new Error(
        detail || `FastAPI scoring failed with HTTP ${response.status}.`
      );
    }

    if (!Array.isArray(data?.results)) {
      throw new Error(
        "Invalid FastAPI response: expected a results array."
      );
    }

    if (data.results.length !== rows.length) {
      throw new Error(
        `Scoring result count mismatch. Sent ${rows.length} rows but received ${data.results.length} results.`
      );
    }

    const scored = rows.map((row, index) => ({
      ...row,
      ...validateModelResult(data.results[index], index),
    }));

    return {
      scored,
      mode: "api",
    };
  } catch (error) {
    if (allowDemoFallback) {
      return {
        scored: rows.map(scoreDemoRow),
        mode: "demo",
      };
    }

    throw error;
  }
}

function generateDemoRows(count = 100) {
  const total = Math.max(1, Math.min(Number(count) || 100, 10000));
  const types = ["TRANSFER", "CASH_OUT", "PAYMENT", "CASH_IN"];

  return Array.from({ length: total }, (_, index) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const amount = Math.round(100 + Math.random() * 150000);
    const oldBalance = Math.round(Math.random() * 200000);

    return {
      step: index + 1,
      type,
      amount,
      nameOrig: `SENDER_${1000 + index}`,
      oldbalanceOrg: oldBalance,
      newbalanceOrig: Math.max(0, oldBalance - amount),
      nameDest: `RECEIVER_${2000 + index}`,
      oldbalanceDest: Math.round(Math.random() * 200000),
      newbalanceDest: Math.round(Math.random() * 300000),
    };
  });
}

export {
  API_URL,
  FRAUD_TYPES,
  REQUIRED_COLUMNS,
  RISK_THRESHOLDS,
  getRiskLevel,
  combineScore,
  scoreDemoRow,
  scoreRows,
  generateDemoRows,
};
