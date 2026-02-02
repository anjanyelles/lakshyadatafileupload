const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

const Upload = require("../models/Upload");
const HeaderMapping = require("../models/HeaderMapping");
const {
  readExcelHeaders,
  getOrCreateHeaderMapping,
  createHeaderSignature,
  processExcelFile,
} = require("../services/excelProcessor");

const router = express.Router();

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 10;

const ensureUploadDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") {
      return cb(null, true);
    }
    return cb(new Error("Only .xlsx or .xls files are allowed."));
  },
});

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const processingQueue = [];
let isProcessing = false;

const processNextUpload = () => {
  if (isProcessing) {
    return;
  }
  const job = processingQueue.shift();
  if (!job) {
    return;
  }

  isProcessing = true;
  setImmediate(async () => {
    try {
      await processExcelFile(job.filePath, job.headerMapping, job.uploadBatchId);
    } catch (error) {
      await Upload.updateOne(
        { _id: job.uploadBatchId },
        {
          $set: { status: "failed" },
          $push: { errorRows: { error: error.message } },
        }
      );
    } finally {
      isProcessing = false;
      processNextUpload();
    }
  });
};

const enqueueProcessing = ({ filePath, headerMapping, uploadBatchId }) => {
  processingQueue.push({ filePath, headerMapping, uploadBatchId });
  processNextUpload();
};

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required." });
    }

    const uploadDoc = await Upload.create({
      fileName: req.file.originalname,
      filePath: req.file.path,
      status: "processing",
      totalRows: 0,
      processedRows: 0,
      errorRows: [],
    });

    const headers = await readExcelHeaders(req.file.path);
    if (headers.length === 0) {
      await Upload.updateOne(
        { _id: uploadDoc._id },
        { $set: { status: "failed" }, $push: { errorRows: { error: "No headers found." } } }
      );
      return res.status(400).json({ error: "No headers found in file." });
    }

    const headerSignature = createHeaderSignature(headers);
    await Upload.updateOne({ _id: uploadDoc._id }, { $set: { headerSignature } });

    const mapping = await getOrCreateHeaderMapping(headers);
    if (!mapping) {
      return res.status(200).json({
        needsMapping: true,
        headers,
        uploadId: uploadDoc._id,
      });
    }

    await enqueueProcessing({
      filePath: req.file.path,
      headerMapping: mapping,
      uploadBatchId: uploadDoc._id,
    });

    return res.status(200).json({ uploadId: uploadDoc._id, status: "processing" });
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds 500MB limit." });
    }
    return next(error);
  }
});

router.post(
  "/upload/:uploadId/confirm-mapping",
  [body("mapping").isObject().withMessage("Mapping object is required.")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { uploadId } = req.params;
      if (!isValidObjectId(uploadId)) {
        return res.status(400).json({ error: "Invalid upload ID." });
      }

      const { mapping } = req.body;

      const uploadDoc = await Upload.findById(uploadId);
      if (!uploadDoc) {
        return res.status(404).json({ error: "Upload not found." });
      }

      const headers = await readExcelHeaders(uploadDoc.filePath);
      if (headers.length === 0) {
        await Upload.updateOne(
          { _id: uploadId },
          { $set: { status: "failed" }, $push: { errorRows: { error: "No headers found." } } }
        );
        return res.status(400).json({ error: "No headers found in file." });
      }

      const headerSignature = createHeaderSignature(headers);
      const mappingDoc = await HeaderMapping.findOneAndUpdate(
        { headerSignature },
        {
          headerSignature,
          originalHeaders: headers,
          mappedHeaders: mapping,
        },
        { upsert: true, new: true }
      );

      await Upload.updateOne(
        { _id: uploadId },
        { $set: { headerSignature: mappingDoc.headerSignature } }
      );

      await enqueueProcessing({
        filePath: uploadDoc.filePath,
        headerMapping: mappingDoc,
        uploadBatchId: uploadId,
      });

      return res.status(200).json({ uploadId, status: "processing" });
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/upload/bulk", upload.array("files", MAX_FILES_PER_BATCH), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Excel files are required." });
    }

    const results = [];
    for (const file of req.files) {
      const uploadDoc = await Upload.create({
        fileName: file.originalname,
        filePath: file.path,
        status: "processing",
        totalRows: 0,
        processedRows: 0,
        errorRows: [],
      });

      const headers = await readExcelHeaders(file.path);
      if (headers.length === 0) {
        await Upload.updateOne(
          { _id: uploadDoc._id },
          { $set: { status: "failed" }, $push: { errorRows: { error: "No headers found." } } }
        );
        results.push({
          fileName: file.originalname,
          uploadId: uploadDoc._id,
          status: "failed",
          error: "No headers found.",
        });
        continue;
      }

      const headerSignature = createHeaderSignature(headers);
      await Upload.updateOne({ _id: uploadDoc._id }, { $set: { headerSignature } });

      const mapping = await getOrCreateHeaderMapping(headers);
      if (!mapping) {
        results.push({
          fileName: file.originalname,
          uploadId: uploadDoc._id,
          needsMapping: true,
          headers,
        });
        continue;
      }

      await enqueueProcessing({
        filePath: file.path,
        headerMapping: mapping,
        uploadBatchId: uploadDoc._id,
      });

      results.push({
        fileName: file.originalname,
        uploadId: uploadDoc._id,
        status: "processing",
      });
    }

    return res.status(200).json({ results });
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds 500MB limit." });
    }
    return next(error);
  }
});

router.get("/upload/:uploadId/status", async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    if (!isValidObjectId(uploadId)) {
      return res.status(400).json({ error: "Invalid upload ID." });
    }

    const uploadDoc = await Upload.findById(uploadId).lean();
    if (!uploadDoc) {
      return res.status(404).json({ error: "Upload not found." });
    }

    return res.status(200).json({
      status: uploadDoc.status,
      totalRows: uploadDoc.totalRows || 0,
      processedRows: uploadDoc.processedRows || 0,
      errors: Array.isArray(uploadDoc.errorRows) ? uploadDoc.errorRows.length : 0,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/uploads", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      if (req.query.startDate) {
        filters.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const [uploads, total, statusCounts] = await Promise.all([
      Upload.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Upload.countDocuments(filters),
      Upload.aggregate([
        { $match: filters },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      data: uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        byStatus: statusCounts.reduce((acc, entry) => {
          acc[entry._id] = entry.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
