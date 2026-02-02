const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const Candidate = require("../models/Candidate");

dotenv.config();

const ADMIN_USER = {
  email: "admin@example.com",
  password: "Admin123!",
  role: "admin",
  name: "Admin User",
};

const RECRUITER_USER = {
  email: "recruiter@example.com",
  password: "Recruiter123!",
  role: "recruiter",
  name: "Recruiter User",
};

const FIRST_NAMES = [
  "Aarav",
  "Ananya",
  "Riya",
  "Vikram",
  "Priya",
  "Rahul",
  "Meera",
  "Karan",
  "Isha",
  "Dev",
  "Neha",
  "Arjun",
  "Sanya",
  "Kabir",
  "Tara",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Patel",
  "Nair",
  "Reddy",
  "Kapoor",
  "Menon",
  "Gupta",
  "Joshi",
  "Mehta",
  "Khan",
  "Singh",
];

const LOCATIONS = [
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Remote",
  "Kolkata",
  "Jaipur",
];

const COMPANIES = [
  "Laksya Tech",
  "BluePeak Systems",
  "Nexus Labs",
  "OrbitWorks",
  "CloudNova",
  "Infinetix",
  "ZenithSoft",
  "PulseStack",
];

const DESIGNATIONS = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Data Analyst",
  "DevOps Engineer",
  "Product Designer",
  "QA Engineer",
  "Engineering Manager",
];

const SKILLS = [
  "React",
  "Node.js",
  "MongoDB",
  "TypeScript",
  "Python",
  "AWS",
  "Docker",
  "Kubernetes",
  "SQL",
  "Figma",
  "Next.js",
  "Express",
];

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];

const buildCandidate = (index) => {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const email = `${firstName}.${lastName}.${index}@example.com`.toLowerCase();
  const experienceYears = Number((Math.random() * 12 + 0.5).toFixed(1));
  const skills = Array.from({ length: 3 }, () => randomItem(SKILLS)).filter(
    (value, idx, self) => self.indexOf(value) === idx
  );

  return {
    firstName,
    lastName,
    fullName,
    email,
    phone: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
    experienceYears,
    skills,
    location: randomItem(LOCATIONS),
    currentCompany: randomItem(COMPANIES),
    designation: randomItem(DESIGNATIONS),
    sourceFile: "seed.xlsx",
    rawData: {
      Name: fullName,
      Email: email,
      Experience: experienceYears,
      Skills: skills.join(", "),
      Location: randomItem(LOCATIONS),
    },
  };
};

const upsertUser = async (payload) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    return existing;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);
  return User.create({
    email: payload.email,
    password: hashedPassword,
    role: payload.role,
    name: payload.name,
  });
};

const seedCandidates = async (count) => {
  const candidates = Array.from({ length: count }, (_, index) => buildCandidate(index + 1));
  await Candidate.insertMany(candidates, { ordered: false });
  return candidates.length;
};

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(mongoUri);

  await upsertUser(ADMIN_USER);
  await upsertUser(RECRUITER_USER);

  const shouldSeedCandidates =
    process.argv.includes("--with-candidates") || process.env.SEED_SAMPLE === "true";

  if (shouldSeedCandidates) {
    const count = await seedCandidates(100);
    console.log(`Seeded ${count} candidates.`);
  } else {
    console.log("Skipping candidate seed. Use --with-candidates to enable.");
  }

  await mongoose.disconnect();
  console.log("Seed complete.");
};

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
