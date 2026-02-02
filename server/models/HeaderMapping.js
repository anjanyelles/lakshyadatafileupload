const mongoose = require("mongoose");

const { Schema } = mongoose;

const HeaderMappingSchema = new Schema(
  {
    headerSignature: { type: String, unique: true, index: true },
    originalHeaders: [{ type: String, trim: true }],
    mappedHeaders: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("HeaderMapping", HeaderMappingSchema);
