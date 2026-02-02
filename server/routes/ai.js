const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");

const HeaderMapping = require("../models/HeaderMapping");

const router = express.Router();

const buildPrompt = (headers) => {
  const headerList = JSON.stringify(headers || []);
  return `You are a data normalization assistant.

Map these Excel headers to canonical recruitment database fields.

Canonical fields:
- firstName
- lastName
- fullName
- email
- phone
- experienceYears
- skills
- location
- currentCompany
- designation

Rules:
- Map only clear matches
- Use null if unsure
- Output ONLY valid JSON object
- No markdown, no explanation

Headers: ${headerList}

Output format:
{
  "Excel Header": "canonicalField",
  ...
}`;
};

const INGESTION_SCHEMA_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "totalExperience",
  "designation",
  "currentCompany",
  "currentLocation",
  "jobLocation",
  "highestQualification",
  "recruiterName",
  "clientName",
  "industry",
  "submissionDate",
  "candidateStatus",
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

  totalExperience: [
    "total exp",
    "experience",
    "total experience",
    "overall experience",
    "years of experience",
    "exp",
    "work experience"
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

  currentCompany: [
    "current company",
    "current employer",
    "present company",
    "present employer",
    "current organization",
    "company",
    "organization"
  ],

  currentLocation: [
    "current location",
    "current city",
    "present location",
    "location",
    "city",
    "residing location"
  ],

  jobLocation: [
    "job location",
    "work location",
    "preferred location",
    "preferred locations",
    "posting location"
  ],

  highestQualification: [
    "highest qualification",
    "qualification",
    "education",
    "educational qualification",
    "degree",
    "highest degree"
  ],

  recruiterName: [
    "recruiter",
    "recruiter name",
    "hr",
    "hr name",
    "talent acquisition",
    "sourcer"
  ],

  clientName: [
    "client",
    "client name",
    "hiring company",
    "customer",
    "end client"
  ],

  industry: [
    "industry",
    "domain",
    "sector"
  ],

  submissionDate: [
    "date of submission",
    "submitted on",
    "date of application",
    "application date",
    "cv submitted date"
  ],

  candidateStatus: [
    "status",
    "final status",
    "candidate status",
    "selection status",
    "result"
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

const normalizeRow = (rawRow, mapping) => {
  const normalized = {};

  Object.entries(rawRow).forEach(([header, value]) => {
    const field = mapping[header];
    if (!field) {
      return;
    }

    const cleanValue = value === null || value === undefined ? "" : String(value).trim();
    if (!cleanValue) {
      return;
    }

    if (field === "email") {
      normalized.email = normalizeEmail(cleanValue);
      return;
    }
    if (field === "phone") {
      normalized.phone = normalizePhone(cleanValue);
      return;
    }
    if (field === "totalExperience") {
      normalized.totalExperience = parseExperience(cleanValue);
      return;
    }

    normalized[field] = cleanValue;
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
    if (normalized.includes("phone") || normalized.includes("mobile") || normalized.includes("contact")) {
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
    if (normalized.includes("experience")) {
      mapping[header] = "experienceYears";
      return;
    }
    if (normalized.includes("skill")) {
      mapping[header] = "skills";
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
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Unable to locate JSON object in AI response.");
  }
  return JSON.parse(match[0]);
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
          mapping = aiMapping;
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
          record[field] = normalized[field] || "";
        });

        validRecords.push(record);
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

module.exports = router;
