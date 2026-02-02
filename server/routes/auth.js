const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const User = require("../models/User");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const buildToken = (user) =>
  jwt.sign(
    {
      sub: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const sanitizeUser = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
});

router.post(
  "/auth/register",
  requireAuth,
  requireAdmin,
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be 8+ chars."),
    body("role").optional().isIn(["admin", "recruiter"]).withMessage("Invalid role."),
    body("name").optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password, name, role } = req.body || {};
      const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
      if (existingUser) {
        return res.status(409).json({ error: "User already exists." });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: role || "recruiter",
      });

      return res.status(201).json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/auth/login",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body || {};
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const isMatch = await bcrypt.compare(password, user.password || "");
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const token = buildToken(user);
      return res.status(200).json({ token, user: sanitizeUser(user) });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/auth/me", requireAuth, async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.user) });
});

module.exports = router;
