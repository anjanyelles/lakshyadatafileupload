const normalizeApiBase = (value) => {
  if (!value) {
    return "";
  }
  return value.endsWith("/api") ? value : `${value.replace(/\/$/, "")}/api`;
};

export const API_BASE_URL =
  normalizeApiBase(import.meta.env.VITE_API_URL) ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";
