const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", (req, res) => {
  const state = mongoose.connection.readyState;
  const isConnected = state === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "ok" : "degraded",
    db: isConnected ? "connected" : "disconnected",
  });
});

module.exports = router;
