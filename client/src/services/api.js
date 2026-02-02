import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let onUnauthorized = null;

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof onUnauthorized === "function") {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const loginRequest = async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data;
};

export const getCandidates = async () => {
  const response = await api.get("/candidates");
  return response.data.data || [];
};

export const uploadExcelFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const confirmHeaderMapping = async (uploadId, mapping) => {
  const response = await api.post(`/upload/${uploadId}/confirm-mapping`, {
    mapping,
  });
  return response.data;
};

export const getUploadStatus = async (uploadId) => {
  const response = await api.get(`/upload/${uploadId}/status`);
  return response.data;
};

export const getUploads = async ({ page = 1, limit = 20, status, startDate, endDate } = {}) => {
  const response = await api.get("/uploads", {
    params: {
      page,
      limit,
      status,
      startDate,
      endDate,
    },
  });
  return response.data;
};

export const aiMapHeaders = async (headers) => {
  const response = await api.post("/ai/map-headers", { headers });
  return response.data;
};

export const searchCandidates = async (params) => {
  const response = await api.get("/candidates/search", { params });
  return response.data;
};

export const getCandidateById = async (id) => {
  const response = await api.get(`/candidates/${id}`);
  return response.data.data;
};

export const updateCandidateStage = async (id, stage) => {
  const response = await api.patch(`/candidates/${id}/stage`, { stage });
  return response.data.data;
};

export const getCandidateStats = async () => {
  const response = await api.get("/candidates/stats");
  return response.data;
};

export default api;
