const mongoose = require("mongoose");

const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_MAX_RETRIES = 10;

const buildConnectionOptions = () => ({
  maxPoolSize: 20,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
});

const connectWithRetry = async (uri, attempt = 1) => {
  try {
    await mongoose.connect(uri, buildConnectionOptions());
    console.log("MongoDB connected.");
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES) {
      console.error("MongoDB connection failed after retries.", error);
      throw error;
    }

    const delay = DEFAULT_RETRY_DELAY_MS * attempt;
    console.warn(`MongoDB connection failed. Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectWithRetry(uri, attempt + 1);
  }
};

const registerConnectionEvents = (uri) => {
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected. Reconnecting...");
    connectWithRetry(uri).catch((error) => {
      console.error("MongoDB reconnect failed.", error);
    });
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });
};

const connectDatabase = async (uri) => {
  await connectWithRetry(uri);
  registerConnectionEvents(uri);
  return mongoose.connection;
};

const disconnectDatabase = async () => {
  await mongoose.disconnect();
};

module.exports = { connectDatabase, disconnectDatabase };
