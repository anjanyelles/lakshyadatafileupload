const winston = require("winston");
const fs = require("fs");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

const formats = [
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
];

const transports = [new winston.transports.Console()];

if (isProduction) {
  const logDir = path.resolve(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "app.log"),
      level: "info",
    })
  );
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    })
  );
}

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: winston.format.combine(...formats),
  transports,
});

module.exports = logger;
