const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Candidate = require("../models/Candidate");
const HeaderMapping = require("../models/HeaderMapping");
const Upload = require("../models/Upload");
const User = require("../models/User");

dotenv.config();

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(mongoUri);

  await Promise.all([
    Candidate.syncIndexes(),
    HeaderMapping.syncIndexes(),
    Upload.syncIndexes(),
    User.syncIndexes(),
  ]);

  await mongoose.disconnect();
  console.log("Indexes created.");
};

main().catch((error) => {
  console.error("Index creation failed:", error);
  process.exit(1);
});
