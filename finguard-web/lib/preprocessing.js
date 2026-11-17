
const DEFAULT_REQUIRED_COLUMNS = ["amount", "type"];

const NUMERIC_COLUMNS = [
  "step",
  "amount",
  "oldbalanceOrg",
  "newbalanceOrig",
  "oldbalanceDest",
  "newbalanceDest",
];

const IDENTIFIER_COLUMNS = ["nameOrig", "nameDest"];

const OPTIONAL_COLUMNS = [
  "step",
  "nameOrig",
  "nameDest",
  "oldbalanceOrg",
  "newbalanceOrig",
  "oldbalanceDest",
  "newbalanceDest",
  "isFraud",
];

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function normalizeNumber(value) {
  if (isEmpty(value)) return null;

  const normalized =
    typeof value === "string" ? value.trim().replace(/,/g, "") : value;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : NaN;
}

function applyColumnMapping(rows, mapping = null) {
  if (!Array.isArray(rows)) {
    throw new Error("Mapping input must be an array of rows.");
  }

  if (!mapping || typeof mapping !== "object") {
    return rows.map((row) => ({ ...row }));
  }

  return rows.map((row) => {
    const mappedRow = { ...row };

    // Mapping direction: source column -> FinGuard standard column.
    // Example: { payment_value: "amount" }
    Object.entries(mapping).forEach(([sourceColumn, standardColumn]) => {
      if (!sourceColumn || !standardColumn) return;

      if (
        Object.prototype.hasOwnProperty.call(row, sourceColumn) &&
        !isEmpty(row[sourceColumn])
      ) {
        mappedRow[standardColumn] = row[sourceColumn];
      }
    });

    return mappedRow;
  });
}

function getDuplicateKey(row) {
  const keys = Object.keys(row).sort();

  return JSON.stringify(
    keys.map((key) => {
      const value = row[key];

      return isEmpty(value) ? null : String(value).trim();
    })
  );
}

function preprocessRows(
  rawRows,
  {
    mapping = null,
    requiredColumns = DEFAULT_REQUIRED_COLUMNS,
  } = {}
) {
  if (!Array.isArray(rawRows)) {
    throw new Error("Preprocessing input must be an array of rows.");
  }

  if (rawRows.length === 0) {
    return {
      rows: [],
      report: {
        originalRows: 0,
        nonEmptyRows: 0,
        emptyRows: 0,
        validRows: 0,
        rejectedRows: 0,
        duplicateRows: 0,
        malformedRows: 0,
        qualityScore: 0,
        originalColumns: [],
        mappedColumns: [],
        missingValues: 0,
        invalidNumericValues: 0,
        negativeValues: 0,
        invalidFraudLabels: 0,
        rejectedSamples: [],
        duplicatePolicy: "Duplicates are reported but retained.",
        notes: ["The uploaded dataset contains no transaction rows."],
      },
    };
  }

  const originalColumns = [
    ...new Set(rawRows.flatMap((row) => Object.keys(row || {}))),
  ];

  const mappedRows = applyColumnMapping(rawRows, mapping);

  const mappedColumns = [
    ...new Set(mappedRows.flatMap((row) => Object.keys(row || {}))),
  ];

  const required = Array.isArray(requiredColumns)
    ? requiredColumns
    : DEFAULT_REQUIRED_COLUMNS;

  const acceptedRows = [];
  const rejectedSamples = [];
  const seenRows = new Set();

  let emptyRows = 0;
  let nonEmptyRows = 0;
  let malformedRows = 0;
  let duplicateRows = 0;
  let missingValues = 0;
  let invalidNumericValues = 0;
  let negativeValues = 0;
  let invalidFraudLabels = 0;
  let validNumericChecks = 0;
  let totalNumericChecks = 0;

  const rejectRow = (row, rowNumber, reasons) => {
    if (rejectedSamples.length < 20) {
      rejectedSamples.push({
        rowNumber: rowNumber + 1,
        reasons,
        row: { ...row },
      });
    }
  };

  mappedRows.forEach((originalRow, index) => {
    const rowNumber = index;
    const row = { ...(originalRow || {}) };
    const reasons = [];

    if (
      !originalRow ||
      typeof originalRow !== "object" ||
      Array.isArray(originalRow)
    ) {
      malformedRows += 1;
      rejectRow({}, rowNumber, ["Invalid row format."]);
      return;
    }

    const hasAnyValue = Object.values(row).some(
      (value) => !isEmpty(value)
    );

    if (!hasAnyValue) {
      emptyRows += 1;
      return;
    }

    nonEmptyRows += 1;

    // Check required fields.
    required.forEach((column) => {
      if (isEmpty(row[column])) {
        missingValues += 1;
        reasons.push(`Missing required field: ${column}`);
      }
    });

    // Normalize transaction type.
    if (!isEmpty(row.type)) {
      row.type = String(row.type).trim().toUpperCase();
    }

    // Normalize numeric fields.
    NUMERIC_COLUMNS.forEach((column) => {
      const value = row[column];

      if (isEmpty(value)) {
        row[column] = null;

        if (required.includes(column)) {
          reasons.push(`Missing required numeric field: ${column}`);
        }

        return;
      }

      totalNumericChecks += 1;

      const number = normalizeNumber(value);

      if (!Number.isFinite(number)) {
        invalidNumericValues += 1;
        reasons.push(`Invalid numeric value in ${column}`);
        return;
      }

      if (number < 0) {
        negativeValues += 1;
        reasons.push(`Negative value is not allowed in ${column}`);
        return;
      }

      if (column === "step" && !Number.isInteger(number)) {
        invalidNumericValues += 1;
        reasons.push("The step field must be a whole number.");
        return;
      }

      validNumericChecks += 1;
      row[column] = number;
    });

    // Normalize sender and receiver identifiers.
    IDENTIFIER_COLUMNS.forEach((column) => {
      if (isEmpty(row[column])) {
        row[column] = null;

        if (required.includes(column)) {
          reasons.push(`Missing required identifier: ${column}`);
        }

        return;
      }

      row[column] = String(row[column]).trim();
    });

    // Optional fraud label: if supplied, it must be 0 or 1.
    if (!isEmpty(row.isFraud)) {
      const fraudLabel = normalizeNumber(row.isFraud);

      if (
        !Number.isFinite(fraudLabel) ||
        (fraudLabel !== 0 && fraudLabel !== 1)
      ) {
        invalidFraudLabels += 1;
        reasons.push("isFraud must contain only 0 or 1.");
      } else {
        row.isFraud = fraudLabel;
      }
    } else if ("isFraud" in row) {
      row.isFraud = null;
    }

    if (reasons.length > 0) {
      rejectRow(row, rowNumber, reasons);
      return;
    }

    // Detect exact duplicate rows. Duplicates are retained.
    const duplicateKey = getDuplicateKey(row);

    if (seenRows.has(duplicateKey)) {
      duplicateRows += 1;
    } else {
      seenRows.add(duplicateKey);
    }

    acceptedRows.push(row);
  });

  const validRows = acceptedRows.length;
  const rejectedRows = nonEmptyRows - validRows;

  const completenessScore =
    nonEmptyRows > 0
      ? Math.max(
          0,
          100 - (missingValues / (nonEmptyRows * Math.max(required.length, 1))) * 100
        )
      : 0;

  const validityScore =
    nonEmptyRows > 0 ? (validRows / nonEmptyRows) * 100 : 0;

  const numericScore =
    totalNumericChecks > 0
      ? (validNumericChecks / totalNumericChecks) * 100
      : 100;

  const uniquenessScore =
    validRows > 0
      ? ((validRows - duplicateRows) / validRows) * 100
      : 100;

  const qualityScore = Math.round(
    completenessScore * 0.4 +
      validityScore * 0.3 +
      numericScore * 0.2 +
      uniquenessScore * 0.1
  );

  const notes = [];

  if (emptyRows > 0) {
    notes.push(`${emptyRows} completely empty rows were ignored.`);
  }

  if (rejectedRows > 0) {
    notes.push(`${rejectedRows} rows were rejected because of validation errors.`);
  }

  if (duplicateRows > 0) {
    notes.push(
      `${duplicateRows} duplicate rows were detected. They were retained.`
    );
  }

  if (!mappedColumns.includes("isFraud")) {
    notes.push(
      "No fraud label was provided. The dataset can still be scored."
    );
  }

  if (!mappedColumns.includes("step")) {
    notes.push(
      "No step/timestamp field was provided. Timestamp-based analysis may be limited."
    );
  }

  return {
    rows: acceptedRows,
    report: {
      originalRows: rawRows.length,
      nonEmptyRows,
      emptyRows,
      validRows,
      rejectedRows,
      duplicateRows,
      malformedRows,
      qualityScore,
      originalColumns,
      mappedColumns,
      missingValues,
      invalidNumericValues,
      negativeValues,
      invalidFraudLabels,
      rejectedSamples,
      duplicatePolicy: "Duplicates are reported but retained.",
      notes,
    },
  };
}

export {
  DEFAULT_REQUIRED_COLUMNS,
  NUMERIC_COLUMNS,
  OPTIONAL_COLUMNS,
  IDENTIFIER_COLUMNS,
  applyColumnMapping,
  preprocessRows,
};
