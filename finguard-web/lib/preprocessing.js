
import { REQUIRED_COLUMNS } from "./scoring";

const NUMERIC_COLUMNS = [
  "step",
  "amount",
  "oldbalanceOrg",
  "newbalanceOrig",
  "oldbalanceDest",
  "newbalanceDest",
];

const IDENTIFIER_COLUMNS = ["nameOrig", "nameDest"];

const isBlank = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const isRowObject = (row) =>
  row !== null &&
  typeof row === "object" &&
  !Array.isArray(row);

const addReason = (reasons, reason) => {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
};

const normalizeHeaders = (row) => {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim();

    if (!cleanKey) {
      throw new Error("The CSV contains an empty column header.");
    }

    if (Object.hasOwn(normalized, cleanKey)) {
      throw new Error(
        `Duplicate column header after trimming: ${cleanKey}`
      );
    }

    normalized[cleanKey] = value;
  }

  return normalized;
};

const normalizeNumericValue = (value) => {
  if (typeof value !== "number" && typeof value !== "string") {
    return { valid: false };
  }

  if (isBlank(value)) {
    return { valid: false, missing: true };
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return { valid: false };
  }

  return { valid: true, value: number };
};

const createCounter = (columns) =>
  Object.fromEntries(columns.map((column) => [column, 0]));

const calculateQualityScore = ({
  nonEmptyRows,
  validRows,
  missingValues,
  invalidNumericValues,
  negativeValues,
  exactDuplicateRows,
}) => {
  if (nonEmptyRows === 0) {
    return 0;
  }

  const requiredCellCount =
    nonEmptyRows * REQUIRED_COLUMNS.length;

  const numericCellCount =
    nonEmptyRows * NUMERIC_COLUMNS.length;

  const missingCount = Object.values(missingValues).reduce(
    (sum, count) => sum + count,
    0
  );

  const invalidNumericCount = Object.values(
    invalidNumericValues
  ).reduce((sum, count) => sum + count, 0);

  const negativeCount = Object.values(negativeValues).reduce(
    (sum, count) => sum + count,
    0
  );

  const completeness = Math.max(
    0,
    1 - missingCount / Math.max(1, requiredCellCount)
  );

  const rowValidity = validRows / nonEmptyRows;

  const numericValidity = Math.max(
    0,
    1 -
      (invalidNumericCount + negativeCount) /
        Math.max(1, numericCellCount)
  );

  const uniqueness = Math.max(
    0,
    1 - exactDuplicateRows / Math.max(1, validRows)
  );

  // Custom heuristic, not a standardized data-quality metric.
  const score =
    completeness * 40 +
    rowValidity * 30 +
    numericValidity * 20 +
    uniqueness * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
};

export function preprocessRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("The dataset contains no rows.");
  }

  // Find a row containing the CSV headers.
  const headerRow = rawRows.find(
    (row) => isRowObject(row) && Object.keys(row).length > 0
  );

  if (!headerRow) {
    throw new Error(
      "The dataset contains no usable column headers."
    );
  }

  const normalizedHeaderRow = normalizeHeaders(headerRow);
  const columns = Object.keys(normalizedHeaderRow);

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !columns.includes(column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingColumns.join(", ")}`
    );
  }

  const missingValues = createCounter(REQUIRED_COLUMNS);
  const invalidNumericValues = createCounter(NUMERIC_COLUMNS);
  const negativeValues = createCounter(NUMERIC_COLUMNS);

  const validRows = [];
  const rejectedSamples = [];

  let emptyRowsRemoved = 0;
  let rejectedRows = 0;
  let nonEmptyRows = 0;
  let malformedRows = 0;

  const recordRejectedRow = (rowNumber, reasons) => {
    rejectedRows++;

    if (rejectedSamples.length < 10) {
      rejectedSamples.push({
        rowNumber,
        reasons: [...new Set(reasons)],
      });
    }
  };

  for (let index = 0; index < rawRows.length; index++) {
    const rawRow = rawRows[index];
    const rowNumber = index + 2;

    // Safely reject malformed records.
    if (!isRowObject(rawRow)) {
      malformedRows++;
      recordRejectedRow(rowNumber, [
        "Row is not a valid CSV record.",
      ]);
      continue;
    }

    let row;

    try {
      row = normalizeHeaders(rawRow);
    } catch (error) {
      malformedRows++;
      recordRejectedRow(rowNumber, [
        error instanceof Error
          ? error.message
          : "Unable to normalize column headers.",
      ]);
      continue;
    }

    // Remove rows containing no actual values.
    const hasValues = Object.values(row).some(
      (value) => !isBlank(value)
    );

    if (!hasValues) {
      emptyRowsRemoved++;
      continue;
    }

    nonEmptyRows++;

    const reasons = [];

    // Check every required field for missing data.
    for (const column of REQUIRED_COLUMNS) {
      if (isBlank(row[column])) {
        missingValues[column]++;

        addReason(
          reasons,
          `Missing required value: ${column}`
        );
      }
    }

    // Standardize identifiers without changing their case.
    for (const column of IDENTIFIER_COLUMNS) {
      if (!isBlank(row[column])) {
        row[column] = String(row[column]).trim();
      }
    }

    // Standardize transaction types.
    if (!isBlank(row.type)) {
      row.type = String(row.type).trim().toUpperCase();
    }

    // Validate numeric fields.
    for (const column of NUMERIC_COLUMNS) {
      const result = normalizeNumericValue(row[column]);

      if (!result.valid) {
        if (!result.missing) {
          invalidNumericValues[column]++;

          addReason(
            reasons,
            `Invalid numeric value: ${column}`
          );
        } else if (!isBlank(row[column])) {
          addReason(
            reasons,
            `Invalid numeric value: ${column}`
          );
        }

        continue;
      }

      row[column] = result.value;

      if (column === "step" && !Number.isInteger(row[column])) {
        addReason(reasons, "step must be an integer.");
      }

      if (row[column] < 0) {
        negativeValues[column]++;

        addReason(
          reasons,
          `${column} cannot be negative.`
        );
      }
    }

    if (reasons.length > 0) {
      recordRejectedRow(rowNumber, reasons);
      continue;
    }

    validRows.push(row);
  }

  if (validRows.length === 0) {
    throw new Error(
      `No valid rows remain. ${rejectedRows} rows were rejected.`
    );
  }

  // Detect exact duplicate rows without deleting them.
  const seen = new Set();
  let exactDuplicateRows = 0;

  for (const row of validRows) {
    const fingerprint = JSON.stringify(
      Object.keys(row)
        .sort()
        .map((key) => [key, row[key]])
    );

    if (seen.has(fingerprint)) {
      exactDuplicateRows++;
    } else {
      seen.add(fingerprint);
    }
  }

  const dataQualityScore = calculateQualityScore({
    nonEmptyRows,
    validRows: validRows.length,
    missingValues,
    invalidNumericValues,
    negativeValues,
    exactDuplicateRows,
  });

  return {
    rows: validRows,

    report: {
      originalRows: rawRows.length,
      nonEmptyRows,
      emptyRowsRemoved,
      malformedRows,
      validRows: validRows.length,
      rejectedRows,
      exactDuplicateRows,
      dataQualityScore,

      missingValues,
      invalidNumericValues,
      negativeValues,

      rejectedSamples,

      duplicatePolicy:
        "Exact duplicates are detected and preserved for review.",

      dataQualityScoreMethod:
        "Custom heuristic: completeness 40%, row validity 30%, numeric validity 20%, and uniqueness 10%.",

      notes: [
        "Only rows with valid required fields are retained.",
        "Negative numeric values are rejected.",
        "Transaction types are normalized but not restricted to TRANSFER or CASH_OUT.",
        "Exact duplicate transactions are reported but not automatically removed.",
        "Blank lines already removed by the CSV parser cannot be counted here.",
        "Row numbers are approximate CSV line numbers.",
      ],
    },
  };
}
