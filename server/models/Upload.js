const mongoose = require("mongoose");

const { Schema } = mongoose;

const UploadSchema = new Schema(
  {
    fileName: { type: String, trim: true },
    filePath: { type: String, trim: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    totalRows: { type: Number, min: 0 },
    processedRows: { type: Number, min: 0 },
    errorRows: [{ type: Schema.Types.Mixed }],
    headerSignature: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", UploadSchema);
