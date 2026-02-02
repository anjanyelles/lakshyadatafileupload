import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmHeaderMapping,
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

const Upload = () => {
  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState("");
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [needsMapping, setNeedsMapping] = useState(false);
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => file && !isSubmitting, [file, isSubmitting]);

  const handleUpload = async () => {
    if (!file) {
      setError("Select an Excel file to upload.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    setNeedsMapping(false);
    setHeaders([]);
    setMapping({});
    setUploadId("");
    setStatus("");
    setStats(null);

    try {
      const response = await uploadExcelFile(file);
      if (response.needsMapping) {
        setNeedsMapping(true);
        setHeaders(response.headers || []);
        setMapping(
          (response.headers || []).reduce((acc, header) => {
            acc[header] = "";
            return acc;
          }, {})
        );
        setUploadId(response.uploadId || "");
      } else {
        setUploadId(response.uploadId || "");
        setStatus(response.status || "processing");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMappingChange = (header, value) => {
    setMapping((prev) => ({ ...prev, [header]: value || null }));
  };

  const handleConfirmMapping = async () => {
    if (!uploadId) {
      setError("Upload ID missing. Please re-upload the file.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await confirmHeaderMapping(uploadId, mapping);
      setNeedsMapping(false);
      setStatus(response.status || "processing");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Mapping failed.");
    } finally {
      setIsSubmitting(false);
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
      setError(err.response?.data?.error || err.message || "Unable to fetch status.");
    }
  }, [uploadId]);

  useEffect(() => {
    if (!uploadId || status !== "processing") {
      return undefined;
    }

    const interval = setInterval(() => {
      refreshStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [uploadId, status, refreshStatus]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Upload Center
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Import candidates</h1>
        <p className="text-base text-slate-600">
          Upload Excel files and map headers to your canonical recruitment fields.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Excel file</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-slate-500">Max size: 500MB.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canSubmit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Upload
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
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {needsMapping && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Map headers</h2>
            <p className="text-sm text-slate-600">
              Select a canonical field for each Excel header. Leave blank to skip.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {headers.map((header) => (
              <div key={header} className="space-y-2">
                <div className="text-sm font-medium text-slate-700">{header}</div>
                <select
                  value={mapping[header] || ""}
                  onChange={(event) => handleMappingChange(header, event.target.value)}
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

          <div className="mt-6">
            <button
              type="button"
              onClick={handleConfirmMapping}
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Confirm mapping &amp; process
            </button>
          </div>
        </div>
      )}

      {uploadId && !needsMapping && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Upload status</h2>
            <p className="text-sm text-slate-600">Upload ID: {uploadId}</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div>
              <span className="font-semibold">Status:</span> {status || "pending"}
            </div>
            <div>
              <span className="font-semibold">Processed:</span>{" "}
              {stats?.processedRows ?? 0} / {stats?.totalRows ?? 0}
            </div>
            <div>
              <span className="font-semibold">Errors:</span> {stats?.errors ?? 0}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Upload;
