const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const healthRoutes = require("./routes/health");
const candidateRoutes = require("./routes/candidates");
const uploadRoutes = require("./routes/upload");
const searchRoutes = require("./routes/search");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");
const { getRequiredEnv } = require("./utils/env");
const { connectDatabase, disconnectDatabase } = require("./config/db");
const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();

app.set("trust proxy", 1);

const BODY_LIMIT = process.env.BODY_LIMIT || "2mb";
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked for this origin."));
    },
  })
);

app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: REQUEST_WINDOW_MS,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });
  next();
});
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use("/api/health", healthRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/candidates", searchRoutes);
app.use("/api", uploadRoutes);
app.use("/api", authRoutes);
app.use("/api", aiRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = getRequiredEnv("MONGODB_URI");

let server;

const startServer = async () => {
  try {
    await connectDatabase(MONGODB_URI);
    server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

const shutdown = async () => {
  console.log("Shutting down gracefully...");
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
