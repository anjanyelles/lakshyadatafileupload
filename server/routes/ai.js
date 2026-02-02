const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");

const HeaderMapping = require("../models/HeaderMapping");

const router = express.Router();

const buildPrompt = (headers) => {
  const headerList = JSON.stringify(headers || []);
  return `You are a data normalization assistant.

You will receive Excel column headers that may vary in naming.
Your task is to semantically understand each header and map it
to the STANDARD FIELD NAME.

STANDARD FIELDS:
firstName, lastName, fullName, email, phone, alternatePhone,
candidateId, designation, skills, technicalSkills,
totalExperience, relevantExperience, currentCompany,
expectedSalary, currentSalary, location, noticePeriod,
education, source, remarks

Rules:
- Map only if meaning is clear
- If no suitable field exists, return null
- Do not guess
- Output JSON only, no markdown or explanation

Headers: ${headerList}

Return JSON only in this format:
[
  {
    "originalHeader": "string",
    "mappedField": "standardFieldName | null"
  }
]`;
};

const INGESTION_SCHEMA_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "alternatePhone",
  "designation",
  "skills",
  "technicalSkills",
  "totalExperience",
  "relevantExperience",
  "currentCompany",
  "expectedSalary",
  "currentSalary",
  "location",
  "noticePeriod",
  "education",
  "source",
  "remarks",
];

const createHeaderSignature = (headers) => {
  const normalized = (headers || [])
    .map((header) => String(header || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();

  return crypto.createHash("sha1").update(normalized.join("|")).digest("hex");
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ");

const HEADER_SYNONYMS = {
  firstName: [
    "first name",
    "firstname",
    "candidate first name",
    "given name",
    "fname"
  ],

  lastName: [
    "last name",
    "lastname",
    "surname",
    "family name",
    "lname"
  ],

  fullName: [
    "full name",
    "candidate name",
    "name",
    "applicant name",
    "employee name",
    "candidate full name"
  ],

  email: [
    "email",
    "email id",
    "email address",
    "mail",
    "e mail",
    "official email",
    "personal email",
    "candidate email"
  ],

  phone: [
    "phone",
    "mobile",
    "mobile number",
    "phone number",
    "contact",
    "contact number",
    "contact no",
    "cell",
    "cell number",
    "mob"
  ],

  alternatePhone: [
    "alternate phone",
    "alternate number",
    "alternate contact",
    "secondary phone",
    "secondary number",
    "other phone",
    "alt phone",
    "alt number"
  ],

  candidateId: [
    "candidate id",
    "candidate code",
    "applicant id",
    "applicant code",
    "candidate number",
    "candidate no"
  ],

  designation: [
    "designation",
    "position",
    "job title",
    "role",
    "applied position",
    "profile",
    "job role"
  ],

  skills: [
    "skills",
    "skill set",
    "key skills",
    "primary skills",
    "skillset"
  ],

  technicalSkills: [
    "technical skills",
    "tech skills",
    "technology skills",
    "technical skill set"
  ],

  totalExperience: [
    "total exp",
    "experience",
    "total experience",
    "overall experience",
    "years of experience",
    "exp",
    "work experience"
  ],

  relevantExperience: [
    "relevant experience",
    "relevant exp",
    "relevant years",
    "domain experience"
  ],

  currentCompany: [
    "current company",
    "current employer",
    "present company",
    "present employer",
    "current organization",
    "company",
    "organization"
  ],

  expectedSalary: [
    "expected salary",
    "expected ctc",
    "expected compensation",
    "expected pay",
    "exp salary",
    "exp ctc"
  ],

  currentSalary: [
    "current salary",
    "current ctc",
    "current compensation",
    "present salary",
    "present ctc"
  ],

  location: [
    "location",
    "current location",
    "present location",
    "current city",
    "city",
    "residing location",
    "preferred location"
  ],

  noticePeriod: [
    "notice period",
    "notice",
    "np",
    "joining time",
    "availability"
  ],

  education: [
    "education",
    "qualification",
    "educational qualification",
    "degree",
    "highest qualification",
    "highest degree"
  ],

  source: [
    "source",
    "source of hire",
    "sourced from",
    "referral source",
    "portal"
  ],

  remarks: [
    "remarks",
    "comment",
    "comments",
    "notes",
    "note",
    "feedback"
  ]
};

const mapHeadersToSchema = (headers) => {
  const mapping = {};
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    let matched = null;

    Object.entries(HEADER_SYNONYMS).forEach(([field, aliases]) => {
      if (matched) {
        return;
      }
      if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        matched = field;
      }
    });

    mapping[header] = matched;
  });

  return mapping;
};

const normalizeEmail = (value) => {
  if (!value) {
    return null;
  }
  const email = String(value).trim().toLowerCase();
  if (!email || email === "na" || email === "n/a") {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
};

const normalizePhone = (value) => {
  if (!value) {
    return null;
  }
  const digits = String(value).replace(/\D/g, "");
  if (!digits || digits.length < 7) {
    return null;
  }
  return digits;
};

const isValidEmail = (value) => {
  if (!value) {
    return false;
  }
  const email = String(value).trim().toLowerCase();
  if (!email || email === "na" || email === "n/a") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getPhoneDigits = (value) => {
  if (!value) {
    return "";
  }
  return String(value).replace(/\D/g, "");
};

const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const parseExperience = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "na" || raw === "n/a") {
    return null;
  }
  const numberMatch = raw.match(/(\d+(\.\d+)?)/);
  if (!numberMatch) {
    return null;
  }
  return Number.parseFloat(numberMatch[1]);
};

const splitName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  const firstName = parts.shift();
  const lastName = parts.join(" ");
  return { firstName, lastName };
};

const parseSkillList = (value) => {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "na" || raw.toLowerCase() === "n/a") {
    return [];
  }
  return raw
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeRow = (rawRow, mapping) => {
  const normalized = {};

  Object.entries(rawRow).forEach(([header, value]) => {
    const field = mapping[header];
    if (!field) {
      return;
    }

    if (field === "email") {
      normalized.email = normalizeEmail(value);
      return;
    }
    if (field === "phone") {
      normalized.phone = normalizePhone(value);
      return;
    }
    if (field === "alternatePhone") {
      normalized.alternatePhone = normalizePhone(value);
      return;
    }
    if (field === "totalExperience" || field === "relevantExperience") {
      normalized[field] = parseExperience(value);
      return;
    }
    if (field === "skills" || field === "technicalSkills") {
      normalized[field] = parseSkillList(value);
      return;
    }

    normalized[field] = normalizeString(value);
  });

  if (normalized.fullName && (!normalized.firstName || !normalized.lastName)) {
    const split = splitName(normalized.fullName);
    normalized.firstName = normalized.firstName || split.firstName;
    normalized.lastName = normalized.lastName || split.lastName;
  }

  return normalized;
};

const heuristicMap = (headers) => {
  const mapping = {};
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (!normalized) {
      mapping[header] = null;
      return;
    }

    if (normalized.includes("email")) {
      mapping[header] = "email";
      return;
    }
    if (
      normalized.includes("alternate") ||
      normalized.includes("secondary") ||
      normalized.includes("other phone") ||
      normalized.includes("alt phone")
    ) {
      mapping[header] = "alternatePhone";
      return;
    }
    if (
      normalized.includes("phone") ||
      normalized.includes("mobile") ||
      normalized.includes("contact")
    ) {
      mapping[header] = "phone";
      return;
    }
    if (normalized.includes("full name") || normalized === "name") {
      mapping[header] = "fullName";
      return;
    }
    if (normalized.includes("first name")) {
      mapping[header] = "firstName";
      return;
    }
    if (normalized.includes("last name") || normalized.includes("surname")) {
      mapping[header] = "lastName";
      return;
    }
    if (normalized.includes("candidate id") || normalized.includes("applicant id")) {
      mapping[header] = "candidateId";
      return;
    }
    if (normalized.includes("relevant experience") || normalized.includes("relevant exp")) {
      mapping[header] = "relevantExperience";
      return;
    }
    if (normalized.includes("experience")) {
      mapping[header] = "totalExperience";
      return;
    }
    if (normalized.includes("skill")) {
      if (normalized.includes("technical") || normalized.includes("tech")) {
        mapping[header] = "technicalSkills";
      } else {
        mapping[header] = "skills";
      }
      return;
    }
    if (normalized.includes("location") || normalized.includes("city")) {
      mapping[header] = "location";
      return;
    }
    if (normalized.includes("company")) {
      mapping[header] = "currentCompany";
      return;
    }
    if (normalized.includes("expected salary") || normalized.includes("expected ctc")) {
      mapping[header] = "expectedSalary";
      return;
    }
    if (normalized.includes("current salary") || normalized.includes("current ctc")) {
      mapping[header] = "currentSalary";
      return;
    }
    if (normalized.includes("notice period") || normalized === "notice" || normalized === "np") {
      mapping[header] = "noticePeriod";
      return;
    }
    if (normalized.includes("education") || normalized.includes("qualification") || normalized.includes("degree")) {
      mapping[header] = "education";
      return;
    }
    if (normalized.includes("source")) {
      mapping[header] = "source";
      return;
    }
    if (normalized.includes("remark") || normalized.includes("comment") || normalized.includes("note")) {
      mapping[header] = "remarks";
      return;
    }
    if (normalized.includes("designation") || normalized.includes("title") || normalized.includes("role")) {
      mapping[header] = "designation";
      return;
    }

    mapping[header] = null;
  });

  return mapping;
};

const parseJsonResponse = (payload) => {
  if (!payload) {
    throw new Error("Empty AI response.");
  }
  const trimmed = payload.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Unable to locate JSON in AI response.");
  }
  return JSON.parse(match[0]);
};

const coerceMapping = (headers, payload) => {
  if (!payload) {
    return null;
  }
  if (Array.isArray(payload)) {
    return payload.reduce((acc, entry) => {
      if (!entry || typeof entry !== "object") {
        return acc;
      }
      const originalHeader = entry.originalHeader;
      if (!originalHeader) {
        return acc;
      }
      acc[originalHeader] =
        entry.mappedField === undefined ? null : entry.mappedField;
      return acc;
    }, {});
  }
  if (typeof payload === "object") {
    return payload;
  }
  return headers.reduce((acc, header) => {
    acc[header] = null;
    return acc;
  }, {});
};

const generateGeminiMapping = async (headers) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const version = process.env.GEMINI_API_VERSION || "v1beta";
  const model = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(headers) }],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${text}`);
  }

  const payload = await response.json();
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseJsonResponse(content);
};

const generateOpenAiMapping = async (headers) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: buildPrompt(headers) }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  return parseJsonResponse(content);
};

router.post(
  "/ai/map-headers",
  [body("headers").isArray({ min: 1 }).withMessage("Headers array is required.")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const headers = req.body.headers;
      const headerSignature = createHeaderSignature(headers);

      const existing = await HeaderMapping.findOne({ headerSignature }).lean();
      if (existing?.mappedHeaders) {
        return res.status(200).json({ mapping: existing.mappedHeaders });
      }

      let mapping = heuristicMap(headers);
      const provider = (process.env.AI_PROVIDER || "heuristic").toLowerCase();
      const shouldUseAI = Object.values(mapping).every((value) => value === null);

      if (provider !== "heuristic" && shouldUseAI) {
        const aiMapping =
          provider === "gemini"
            ? await generateGeminiMapping(headers)
            : await generateOpenAiMapping(headers);

        if (aiMapping) {
          mapping = coerceMapping(headers, aiMapping);
        }
      }

      await HeaderMapping.findOneAndUpdate(
        { headerSignature },
        {
          headerSignature,
          originalHeaders: headers,
          mappedHeaders: mapping,
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({ mapping });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/ai/normalize-records",
  [
    body("headers").isArray({ min: 1 }).withMessage("Headers array is required."),
    body("rows").isArray({ min: 1 }).withMessage("Rows array is required."),
    body("existingEmails").optional().isArray(),
    body("existingPhones").optional().isArray(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const headers = req.body.headers;
      const rows = req.body.rows;
      const existingEmails = new Set(
        (req.body.existingEmails || []).map((email) => String(email).toLowerCase())
      );
      const existingPhones = new Set(
        (req.body.existingPhones || []).map((phone) => String(phone).replace(/\D/g, ""))
      );

      const mapping = mapHeadersToSchema(headers);
      const validRecords = [];
      const seenEmails = new Set();
      const seenPhones = new Set();
      const skipReasons = {
        duplicateEmail: 0,
        duplicatePhone: 0,
        missingRequiredData: 0,
      };

      rows.forEach((rowValues) => {
        const rawRow = {};
        headers.forEach((header, index) => {
          rawRow[header] = rowValues[index];
        });

        const normalized = normalizeRow(rawRow, mapping);

        const email = normalized.email || null;
        const phone = normalized.phone || null;

        if (!email && !phone) {
          skipReasons.missingRequiredData += 1;
          return;
        }

        if (email && (existingEmails.has(email) || seenEmails.has(email))) {
          skipReasons.duplicateEmail += 1;
          return;
        }

        if (phone && (existingPhones.has(phone) || seenPhones.has(phone))) {
          skipReasons.duplicatePhone += 1;
          return;
        }

        if (email) {
          seenEmails.add(email);
        }
        if (phone) {
          seenPhones.add(phone);
        }

      const record = {};
      INGESTION_SCHEMA_FIELDS.forEach((field) => {
        if (field === "source") {
          record.source = normalized.source || "Excel Import";
          return;
        }
        if (field === "skills" || field === "technicalSkills") {
          record[field] = normalized[field] || [];
          return;
        }
        record[field] = normalized[field] ?? null;
      });

      validRecords.push({ candidate: record });
      });

      const skippedCount =
        skipReasons.duplicateEmail + skipReasons.duplicatePhone + skipReasons.missingRequiredData;

      return res.status(200).json({
        validRecords,
        skippedCount,
        skipReasons,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/ai/validate-candidate",
  [body("candidate").isObject().withMessage("Candidate payload is required.")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const candidate = req.body.candidate || {};
      const rawEmail = candidate.email;
      const rawPhone = candidate.phone || candidate.alternatePhone;

      const hasEmail = rawEmail !== null && rawEmail !== undefined && String(rawEmail).trim() !== "";
      const hasPhone = rawPhone !== null && rawPhone !== undefined && String(rawPhone).trim() !== "";

      if (!hasEmail && !hasPhone) {
        return res.status(200).json({
          status: "INVALID",
          reason: "Email or phone is required.",
        });
      }

      if (hasEmail && !isValidEmail(rawEmail)) {
        return res.status(200).json({
          status: "INVALID",
          reason: "Email format is invalid.",
        });
      }

      if (hasPhone && getPhoneDigits(rawPhone).length < 10) {
        return res.status(200).json({
          status: "INVALID",
          reason: "Phone must have at least 10 digits.",
        });
      }

      return res.status(200).json({ status: "VALID" });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/ai/dedupe-candidate",
  [
    body("candidate").isObject().withMessage("Candidate payload is required."),
    body("existingEmails").optional().isArray(),
    body("existingPhones").optional().isArray(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const candidate = req.body.candidate || {};
      const rawEmail = candidate.email;
      const rawPhone = candidate.phone;

      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";
      const phoneDigits = getPhoneDigits(rawPhone);

      const existingEmails = new Set(
        (req.body.existingEmails || []).map((value) => String(value).trim().toLowerCase())
      );
      const existingPhones = new Set(
        (req.body.existingPhones || []).map((value) => getPhoneDigits(value))
      );

      const emailDuplicate = Boolean(email) && existingEmails.has(email);
      const phoneDuplicate = Boolean(phoneDigits) && existingPhones.has(phoneDigits);

      let duplicateStatus = "NONE";
      if (emailDuplicate && phoneDuplicate) {
        duplicateStatus = "DUPLICATE_BOTH";
      } else if (emailDuplicate) {
        duplicateStatus = "DUPLICATE_EMAIL";
      } else if (phoneDuplicate) {
        duplicateStatus = "DUPLICATE_PHONE";
      }

      return res.status(200).json({ duplicateStatus });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/ai/ingestion-decision",
  [
    body("validation").isObject().withMessage("Validation payload is required."),
    body("dedupe").isObject().withMessage("Dedupe payload is required."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const validation = req.body.validation || {};
      const dedupe = req.body.dedupe || {};

      if (validation.status === "INVALID") {
        return res.status(200).json({
          finalStatus: "INVALID",
          reason: validation.reason || "Validation failed.",
        });
      }

      if (dedupe.duplicateStatus && dedupe.duplicateStatus !== "NONE") {
        return res.status(200).json({
          finalStatus: "DUPLICATE",
          reason: `Duplicate detected: ${dedupe.duplicateStatus}.`,
        });
      }

      return res.status(200).json({ finalStatus: "SUCCESS" });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/ai/audit-log",
  [
    body("rowNumber").isInt({ min: 1 }).withMessage("Row number is required."),
    body("fileName").isString().notEmpty().withMessage("File name is required."),
    body("failureReason").optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { rowNumber, fileName, failureReason } = req.body;
      const timestamp = new Date().toISOString();

      return res.status(200).json({
        rowNumber,
        fileName: String(fileName).trim(),
        failureReason: failureReason ? String(failureReason).trim() : null,
        timestamp,
      });
    } catch (error) {
      return next(error);
    }
  }
);

const TITLE_CASE_EXCEPTIONS = new Set(["and", "or", "of", "the", "in", "for", "to", "with"]);

const ABBREVIATION_MAP = {
  reactjs: "React",
  "react.js": "React",
  nodejs: "Node.js",
  "node.js": "Node.js",
  js: "JavaScript",
  ts: "TypeScript",
};

const normalizeToken = (value) => {
  if (!value) {
    return "";
  }
  const raw = String(value).trim();
  if (!raw) {
    return "";
  }
  const lower = raw.toLowerCase();
  if (ABBREVIATION_MAP[lower]) {
    return ABBREVIATION_MAP[lower];
  }
  const words = lower.split(/\s+/);
  return words
    .map((word, index) => {
      if (index > 0 && TITLE_CASE_EXCEPTIONS.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const normalizeSkillList = (value) => {
  const list = parseSkillList(value);
  const normalized = list
    .map((item) => normalizeToken(item))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

router.post(
  "/ai/normalize-skills-designation",
  [
    body("skills").optional(),
    body("designation").optional(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const normalizedSkills = normalizeSkillList(req.body.skills || []);
      const normalizedDesignation = normalizeToken(req.body.designation || "");

      return res.status(200).json({
        skills: normalizedSkills,
        designation: normalizedDesignation,
      });
    } catch (error) {
      return next(error);
    }
  }
);

const STAGE_ORDER = [
  "PROFILE_SELECTED",
  "CALLED",
  "INTERVIEW_SCHEDULED",
  "FIRST_ROUND_COMPLETED",
  "SECOND_ROUND_SCHEDULED",
  "SECOND_ROUND_COMPLETED",
  "HR_ROUND",
  "FINAL_SELECTED",
  "REJECTED",
  "ON_HOLD",
];

const TERMINAL_STAGES = new Set(["FINAL_SELECTED", "REJECTED"]);

const normalizeStage = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_");

router.post(
  "/ai/validate-stage-transition",
  [
    body("currentStage").isString().notEmpty().withMessage("Current stage is required."),
    body("newStage").isString().notEmpty().withMessage("New stage is required."),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const currentStage = normalizeStage(req.body.currentStage);
      const newStage = normalizeStage(req.body.newStage);

      const currentIndex = STAGE_ORDER.indexOf(currentStage);
      const newIndex = STAGE_ORDER.indexOf(newStage);

      if (currentIndex === -1) {
        return res.status(200).json({
          isValid: false,
          reason: "Current stage is not recognized.",
          normalizedStage: newStage,
        });
      }

      if (newIndex === -1) {
        return res.status(200).json({
          isValid: false,
          reason: "New stage is not recognized.",
          normalizedStage: newStage,
        });
      }

      if (TERMINAL_STAGES.has(currentStage) && currentStage !== newStage) {
        return res.status(200).json({
          isValid: false,
          reason: "Current stage is terminal.",
          normalizedStage: newStage,
        });
      }

      if (newIndex < currentIndex) {
        return res.status(200).json({
          isValid: false,
          reason: "Stage cannot move backward.",
          normalizedStage: newStage,
        });
      }

      if (newIndex > currentIndex + 1) {
        return res.status(200).json({
          isValid: false,
          reason: "Stage transition skips required steps.",
          normalizedStage: newStage,
        });
      }

      return res.status(200).json({
        isValid: true,
        normalizedStage: newStage,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
