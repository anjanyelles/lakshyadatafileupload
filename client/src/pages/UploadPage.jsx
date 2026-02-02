import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  aiMapHeaders,
  confirmHeaderMapping,
  getUploads,
  getUploadStatus,
  uploadExcelFile,
} from "../services/api";

const CANONICAL_FIELDS = [
  "",
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "experienceYears",
  "skills",
  "location",
  "currentCompany",
  "designation",
];

const formatBytes = (value) => {
  if (!value && value !== 0) {
    return "-";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
};

const statusBadge = (status) => {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
};

const UploadPage = () => {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadId, setUploadId] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isMappingSubmitting, setIsMappingSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);

  const percentComplete = useMemo(() => {
    const total = stats?.totalRows || 0;
    const processed = stats?.processedRows || 0;
    if (!total) {
      return 0;
    }
    return Math.min(Math.round((processed / total) * 100), 100);
  }, [stats]);

  const validateFile = (candidate) => {
    if (!candidate) {
      return "Please select a file.";
    }
    const validExtensions = [".xlsx", ".xls"];
    const lowerName = candidate.name.toLowerCase();
    if (!validExtensions.some((ext) => lowerName.endsWith(ext))) {
      return "Only .xlsx or .xls files are allowed.";
    }
    if (candidate.size > 500 * 1024 * 1024) {
      return "File exceeds 500MB limit.";
    }
    return "";
  };

  const handleFileSelect = (candidate) => {
    const validationError = validateFile(candidate);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError("");
    setFile(candidate);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelect(event.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsUploading(true);
    setUploadId("");
    setStatus("");
    setStats(null);
    setHeaders([]);
    setMapping({});
    setShowMappingModal(false);

    try {
      const response = await uploadExcelFile(file);
      if (response.needsMapping) {
        setHeaders(response.headers || []);
        setMapping(
          (response.headers || []).reduce((acc, header) => {
            acc[header] = "";
            return acc;
          }, {})
        );
        setUploadId(response.uploadId || "");
        setShowMappingModal(true);
        return;
      }

      setUploadId(response.uploadId || "");
      setStatus(response.status || "processing");
      await refreshUploads();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmMapping = async () => {
    if (!uploadId) {
      setError("Upload ID missing. Please re-upload the file.");
      return;
    }

    setError("");
    setIsMappingSubmitting(true);

    try {
      const response = await confirmHeaderMapping(uploadId, mapping);
      setShowMappingModal(false);
      setStatus(response.status || "processing");
      await refreshUploads();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Mapping failed.");
    } finally {
      setIsMappingSubmitting(false);
    }
  };

  const handleUseAi = async () => {
    if (!headers.length) {
      return;
    }
    setIsAiLoading(true);
    setError("");
    try {
      const response = await aiMapHeaders(headers);
      const mapped = response?.mapping || response || {};
      setMapping((prev) => ({
        ...prev,
        ...mapped,
      }));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "AI mapping failed.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    if (!uploadId) {
      return;
    }
    try {
      const response = await getUploadStatus(uploadId);
      setStatus(response.status || "");
      setStats(response);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Status check failed.");
    }
  }, [uploadId]);

  const refreshUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const response = await getUploads({ page: 1, limit: 20 });
      setUploads(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load uploads.");
    } finally {
      setUploadsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUploads();
  }, [refreshUploads]);

  useEffect(() => {
    if (!uploadId || status !== "processing") {
      return undefined;
    }
    const interval = setInterval(() => {
      refreshStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [uploadId, status, refreshStatus]);

  useEffect(() => {
    if (status && status !== "processing") {
      refreshUploads();
    }
  }, [status, refreshUploads]);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Upload Center
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Import candidates</h1>
        <p className="text-base text-slate-600">
          Drag and drop an Excel file, map headers, and track progress in real time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed ${
              isDragging ? "border-slate-400 bg-slate-50" : "border-slate-200"
            } bg-white p-6 text-center`}
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Drag &amp; drop your Excel file here
              </p>
              <p className="text-xs text-slate-500">.xlsx or .xls, up to 500MB</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Browse files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
              />
            </div>
            {file && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isUploading ? "Uploading..." : "Start upload"}
            </button>
            {uploadId && (
              <button
                type="button"
                onClick={refreshStatus}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Refresh status
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {uploadId && status && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Upload ID</p>
                  <p className="text-sm font-semibold text-slate-900">{uploadId}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(
                    status
                  )}`}
                >
                  {status}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Progress</span>
                  <span>{percentComplete}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold">Processed:</span>{" "}
                    {stats?.processedRows ?? 0} / {stats?.totalRows ?? 0}
                  </div>
                  <div>
                    <span className="font-semibold">Errors:</span> {stats?.errors ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent uploads</h2>
          <p className="text-sm text-slate-600">
            Monitor your latest files and drill into errors.
          </p>

          <div className="mt-4 space-y-3">
            {uploadsLoading ? (
              <div className="text-sm text-slate-500">Loading uploads...</div>
            ) : uploads.length === 0 ? (
              <div className="text-sm text-slate-500">No uploads yet.</div>
            ) : (
              uploads.map((entry) => (
                <button
                  key={entry._id}
                  type="button"
                  onClick={() => setSelectedUpload(entry)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-300"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{entry.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                      entry.status
                    )}`}
                  >
                    {entry.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedUpload && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedUpload.fileName}
              </h3>
              <p className="text-sm text-slate-600">
                Uploaded {new Date(selectedUpload.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(
                selectedUpload.status
              )}`}
            >
              {selectedUpload.status}
            </span>
          </div>

          <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-3">
            <div>
              <span className="font-semibold">Total rows:</span>{" "}
              {selectedUpload.totalRows || 0}
            </div>
            <div>
              <span className="font-semibold">Processed:</span>{" "}
              {selectedUpload.processedRows || 0}
            </div>
            <div>
              <span className="font-semibold">Errors:</span>{" "}
              {selectedUpload.errorRows?.length || 0}
            </div>
          </div>

          {selectedUpload.errorRows?.length ? (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Recent errors</p>
              <ul className="mt-2 space-y-1">
                {selectedUpload.errorRows.slice(0, 5).map((entry, index) => (
                  <li key={`${entry.rowNumber || "err"}-${index}`}>
                    Row {entry.rowNumber || "-"}: {entry.error || "Unknown error"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Map Excel headers
                </h2>
                <p className="text-sm text-slate-600">
                  Match each header to a canonical field or skip if irrelevant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-2">
              {headers.map((header) => (
                <div key={header} className="grid gap-3 md:grid-cols-[1fr_1fr]">
                  <div className="text-sm font-medium text-slate-700">{header}</div>
                  <select
                    value={mapping[header] || ""}
                    onChange={(event) =>
                      setMapping((prev) => ({ ...prev, [header]: event.target.value || null }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {CANONICAL_FIELDS.map((field) => (
                      <option key={field || "none"} value={field}>
                        {field || "Skip"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleUseAi}
                disabled={isAiLoading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {isAiLoading ? "Mapping..." : "Use AI mapping"}
              </button>
              <button
                type="button"
                onClick={handleConfirmMapping}
                disabled={isMappingSubmitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isMappingSubmitting ? "Submitting..." : "Confirm mapping"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default UploadPage;
