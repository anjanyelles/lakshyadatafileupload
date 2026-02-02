const mongoose = require("mongoose");

const { Schema } = mongoose;

const CandidateSchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    experienceYears: { type: Number, min: 0 },
    skills: [{ type: String, trim: true }],
    location: { type: String, trim: true },
    currentCompany: { type: String, trim: true },
    designation: { type: String, trim: true },
    sourceFile: { type: String, trim: true },
    uploadBatchId: { type: Schema.Types.ObjectId, ref: "Upload", index: true },
    rawData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

CandidateSchema.index({
  fullName: "text",
  email: "text",
  phone: "text",
  skills: "text",
  location: "text",
  currentCompany: "text",
});

CandidateSchema.index({ experienceYears: 1 });

module.exports = mongoose.model("Candidate", CandidateSchema);
