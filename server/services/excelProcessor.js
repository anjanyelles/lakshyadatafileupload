const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");

const Candidate = require("../models/Candidate");
const Upload = require("../models/Upload");
const HeaderMapping = require("../models/HeaderMapping");

const DEFAULT_FLUSH_SIZE = 200;
const DEFAULT_INSERT_BATCH = 250;
const DEFAULT_PROGRESS_INTERVAL = 250;

const normalizeHeader = (header) => {
  if (header === null || header === undefined) {
    return "";
  }

  return String(header).trim();
};

const safeCellValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    if (value.text) {
      return value.text;
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((entry) => entry.text || "").join("");
    }

    if (value.result !== undefined) {
      return value.result;
    }
  }

  return value;
};

const readExcelHeaders = async (filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const row = worksheet.getRow(1);
    const rawHeaders = row.values.slice(1);

    return rawHeaders.map(normalizeHeader).filter((header) => header.length > 0);
  } catch (error) {
    console.error("Failed to read Excel headers:", error.message);
    return [];
  }
};

const createHeaderSignature = (headers) => {
  const normalized = (headers || [])
    .map((header) => normalizeHeader(header).toLowerCase())
    .filter(Boolean)
    .sort();

  const payload = normalized.join("|");
  return crypto.createHash("sha1").update(payload).digest("hex");
};

const getOrCreateHeaderMapping = async (headers) => {
  const headerSignature = createHeaderSignature(headers);
  const mapping = await HeaderMapping.findOne({ headerSignature }).lean();
  return mapping || null;
};

const normalizeRow = (rawRow, headerMapping) => {
  const mapping = headerMapping?.mappedHeaders || headerMapping || {};
  const normalized = {};

  Object.entries(rawRow || {}).forEach(([header, value]) => {
    const canonical = mapping[header];
    if (!canonical) {
      return;
    }

    let cleanValue = safeCellValue(value);
    if (cleanValue === null || cleanValue === undefined) {
      return;
    }

    if (typeof cleanValue === "string") {
      cleanValue = cleanValue.trim();
      if (!cleanValue) {
        return;
      }
    }

    if (canonical === "experienceYears") {
      const parsed = Number.parseFloat(cleanValue);
      if (!Number.isNaN(parsed)) {
        normalized[canonical] = parsed;
      }
      return;
    }

    if (canonical === "skills") {
      if (Array.isArray(cleanValue)) {
        normalized[canonical] = cleanValue.map((skill) => String(skill).trim()).filter(Boolean);
      } else if (typeof cleanValue === "string") {
        normalized[canonical] = cleanValue
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean);
      } else {
        normalized[canonical] = [String(cleanValue).trim()].filter(Boolean);
      }
      return;
    }

    normalized[canonical] = cleanValue;
  });

  if (normalized.fullName && !normalized.firstName && !normalized.lastName) {
    const parts = String(normalized.fullName).trim().split(/\s+/);
    if (parts.length > 0) {
      normalized.firstName = parts.shift();
      normalized.lastName = parts.length > 0 ? parts.join(" ") : "";
    }
  }

  return normalized;
};

const processExcelFile = async (filePath, headerMapping, uploadBatchId) => {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: "emit",
    entries: "emit",
  });

  let headers = [];
  let totalRows = 0;
  let processedRows = 0;
  let errorCount = 0;
  const errorBuffer = [];
  const candidateBuffer = [];

  const flushErrors = async () => {
    if (errorBuffer.length === 0) {
      return;
    }

    const errorsToWrite = errorBuffer.splice(0, errorBuffer.length);
    await Upload.updateOne(
      { _id: uploadBatchId },
      {
        $push: { errorRows: { $each: errorsToWrite } },
      }
    );
  };

  const flushCandidates = async () => {
    if (candidateBuffer.length === 0) {
      return;
    }

    const batch = candidateBuffer.splice(0, candidateBuffer.length);
    const documents = batch.map((entry) => entry.payload);

    try {
      const inserted = await Candidate.insertMany(documents, { ordered: false });
      processedRows += inserted.length;
    } catch (error) {
      const insertedCount = Array.isArray(error.insertedDocs)
        ? error.insertedDocs.length
        : error.result?.result?.nInserted || 0;

      processedRows += insertedCount;

      const writeErrors = Array.isArray(error.writeErrors) ? error.writeErrors : [];
      const errorByIndex = new Map(
        writeErrors.map((entry) => [entry.index, entry.errmsg || entry.message || error.message])
      );

      if (errorByIndex.size === 0) {
        errorCount += 1;
        errorBuffer.push({ error: error.message });
        return;
      }

      errorByIndex.forEach((message, index) => {
        const failed = batch[index];
        if (!failed) {
          return;
        }

        errorCount += 1;
        errorBuffer.push({
          rowNumber: failed.rowNumber,
          error: message,
          rawData: failed.rawData,
        });
      });
    }
  };

  const updateProgress = async () => {
    await Upload.updateOne(
      { _id: uploadBatchId },
      {
        $set: { totalRows, processedRows },
      }
    );
  };

  try {
    await Upload.updateOne(
      { _id: uploadBatchId },
      { $set: { status: "processing", totalRows: 0, processedRows: 0 } }
    );

    const mapping = headerMapping?.mappedHeaders || headerMapping;
    if (!mapping || Object.keys(mapping).length === 0) {
      throw new Error("Missing header mapping for this upload.");
    }

    for await (const worksheetReader of workbookReader) {
      let isHeaderRow = true;

      for await (const row of worksheetReader) {
        if (isHeaderRow) {
          headers = row.values.slice(1).map(normalizeHeader);
          isHeaderRow = false;
          continue;
        }

        totalRows += 1;

        let rawRow = {};
        try {
          rawRow = {};
          headers.forEach((header, index) => {
            if (!header) {
              return;
            }
            rawRow[header] = safeCellValue(row.values[index + 1]);
          });

          const normalized = normalizeRow(rawRow, headerMapping);
          const candidatePayload = {
            ...normalized,
            rawData: rawRow,
            sourceFile: path.basename(filePath),
            uploadBatchId,
          };

          candidateBuffer.push({
            payload: candidatePayload,
            rowNumber: row.number,
            rawData: rawRow,
          });
        } catch (error) {
          errorCount += 1;
          errorBuffer.push({
            rowNumber: row.number,
            error: error.message,
            rawData: rawRow,
          });
        }

        if (candidateBuffer.length >= DEFAULT_INSERT_BATCH) {
          await flushCandidates();
        }

        if (errorBuffer.length >= DEFAULT_FLUSH_SIZE) {
          await flushErrors();
        }

        if (totalRows % DEFAULT_PROGRESS_INTERVAL === 0) {
          await updateProgress();
        }
      }

      break;
    }

    await flushCandidates();
    await flushErrors();
    await Upload.updateOne(
      { _id: uploadBatchId },
      {
        $set: {
          status: "completed",
          totalRows,
          processedRows,
        },
      }
    );

    return { total: totalRows, processed: processedRows, errors: errorCount };
  } catch (error) {
    errorBuffer.push({ error: error.message });
    await flushErrors();
    await Upload.updateOne(
      { _id: uploadBatchId },
      {
        $set: {
          status: "failed",
          totalRows,
          processedRows,
        },
      }
    );
    return { total: totalRows, processed: processedRows, errors: errorCount + 1 };
  }
};

module.exports = {
  readExcelHeaders,
  createHeaderSignature,
  getOrCreateHeaderMapping,
  processExcelFile,
  normalizeRow,
};
