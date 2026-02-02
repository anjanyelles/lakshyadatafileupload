const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");

const HeaderMapping = require("../models/HeaderMapping");

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 800;

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

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createHeaderSignature = (headers) => {
  const normalized = (headers || [])
    .map((header) => String(header || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();

  return crypto.createHash("sha1").update(normalized.join("|")).digest("hex");
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

const saveHeaderMapping = async (headers, mappedHeaders) => {
  const headerSignature = createHeaderSignature(headers);

  const document = await HeaderMapping.findOneAndUpdate(
    { headerSignature },
    {
      headerSignature,
      originalHeaders: headers,
      mappedHeaders,
    },
    { upsert: true, new: true }
  );

  return document;
};

const generateHeaderMapping = async (headers, options = {}) => {
  const {
    useAI = true,
    manualMapping = null,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    retries = DEFAULT_RETRIES,
  } = options;

  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error("Headers must be a non-empty array.");
  }

  if (!useAI) {
    if (!manualMapping || typeof manualMapping !== "object") {
      return null;
    }

    await saveHeaderMapping(headers, manualMapping);
    return manualMapping;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const prompt = buildPrompt(headers);
  const client = new Anthropic({ apiKey });

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response?.content?.[0]?.text;
      const mapping = coerceMapping(headers, parseJsonResponse(text));

      await saveHeaderMapping(headers, mapping);
      return mapping;
    } catch (error) {
      lastError = error;
      const delay = DEFAULT_RETRY_DELAY_MS * attempt;
      await sleep(delay);
    }
  }

  throw lastError || new Error("Failed to generate header mapping.");
};

module.exports = { generateHeaderMapping };
