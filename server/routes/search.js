const express = require("express");
const mongoose = require("mongoose");
const { query, validationResult } = require("express-validator");

const Candidate = require("../models/Candidate");
const Upload = require("../models/Upload");

const router = express.Router();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildRegexFilter = (value) => {
  if (!value) {
    return null;
  }
  return { $regex: value, $options: "i" };
};

router.get(
  "/search",
  [
    query("text").optional().isString().trim(),
    query("skill").optional().isString().trim(),
    query("location").optional().isString().trim(),
    query("company").optional().isString().trim(),
    query("expMin").optional().isFloat({ min: 0 }).toFloat(),
    query("expMax").optional().isFloat({ min: 0 }).toFloat(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      const filters = {};

      if (req.query.text) {
        filters.$text = { $search: req.query.text };
      }

      const skillFilter = buildRegexFilter(req.query.skill);
      if (skillFilter) {
        filters.skills = skillFilter;
      }

      const locationFilter = buildRegexFilter(req.query.location);
      if (locationFilter) {
        filters.location = locationFilter;
      }

      const companyFilter = buildRegexFilter(req.query.company);
      if (companyFilter) {
        filters.currentCompany = companyFilter;
      }

      if (req.query.expMin !== undefined || req.query.expMax !== undefined) {
        filters.experienceYears = {};
        if (req.query.expMin !== undefined) {
          filters.experienceYears.$gte = req.query.expMin;
        }
        if (req.query.expMax !== undefined) {
          filters.experienceYears.$lte = req.query.expMax;
        }
      }

      const projection = req.query.text ? { score: { $meta: "textScore" } } : null;
      const sort = req.query.text
        ? { score: { $meta: "textScore" }, createdAt: -1 }
        : { createdAt: -1 };

      const [candidates, total] = await Promise.all([
        Candidate.find(filters, projection)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Candidate.countDocuments(filters),
      ]);

      return res.status(200).json({
        candidates,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/stats", async (req, res, next) => {
  try {
    const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalCandidates,
      experienceBuckets,
      locationStats,
      skillStats,
      recentUploads,
    ] = await Promise.all([
      Candidate.countDocuments({}),
      Candidate.aggregate([
        { $match: { experienceYears: { $ne: null } } },
        {
          $bucket: {
            groupBy: "$experienceYears",
            boundaries: [0, 1, 3, 5, 8, 12, 20, 50],
            default: "50+",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      Candidate.aggregate([
        { $match: { location: { $exists: true, $ne: "" } } },
        { $group: { _id: "$location", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Candidate.aggregate([
        { $unwind: "$skills" },
        { $match: { skills: { $exists: true, $ne: "" } } },
        { $group: { _id: "$skills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Upload.countDocuments({ createdAt: { $gte: recentSince } }),
    ]);

    return res.status(200).json({
      totalCandidates,
      byExperience: experienceBuckets.map((bucket) => ({
        range: String(bucket._id),
        count: bucket.count,
      })),
      byLocation: locationStats.map((entry) => ({
        location: entry._id,
        count: entry.count,
      })),
      bySkills: skillStats.map((entry) => ({
        skill: entry._id,
        count: entry.count,
      })),
      recentUploads,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid candidate ID." });
    }

    const candidate = await Candidate.findById(id).lean();
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found." });
    }

    return res.status(200).json({ data: candidate });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
