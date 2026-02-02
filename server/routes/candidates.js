const express = require("express");
const { listCandidates, createCandidate } = require("../services/candidateService");

const router = express.Router();

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

module.exports = router;
