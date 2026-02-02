const Candidate = require("../models/Candidate");

const listCandidates = async () => {
  return Candidate.find().sort({ createdAt: -1 }).lean();
};

const createCandidate = async (payload) => {
  const candidate = new Candidate(payload);
  return candidate.save();
};

module.exports = { listCandidates, createCandidate };
