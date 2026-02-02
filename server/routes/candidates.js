const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { listCandidates, createCandidate } = require("../services/candidateService");
const Candidate = require("../models/Candidate");

const router = express.Router();

const STAGE_ORDER = [
  "PROFILE_SELECTED",
  "CALLED",
  "INTERVIEW_SCHEDULED",
  "FIRST_ROUND_COMPLETED",
  "SECOND_ROUND_SCHEDULED",
  "SECOND_ROUND_COMPLETED",
  "HR_ROUND",
  "FINAL_SELECTED",
  "REJECTED",
  "ON_HOLD",
];

const normalizeStage = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

router.get("/", async (req, res, next) => {
  try {
    const candidates = await listCandidates();
    res.json({ data: candidates });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const candidate = await createCandidate(req.body);
    res.status(201).json({ data: candidate });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/stage",
  [body("stage").isString().notEmpty().withMessage("Stage is required.")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid candidate ID." });
      }

      const normalizedStage = normalizeStage(req.body.stage);
      if (!STAGE_ORDER.includes(normalizedStage)) {
        return res.status(400).json({ error: "Invalid stage value." });
      }

      const candidate = await Candidate.findByIdAndUpdate(
        id,
        { interviewStage: normalizedStage },
        { new: true }
      ).lean();

      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found." });
      }

      return res.status(200).json({ data: candidate });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
