import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { API_BASE_URL } from "../utils/constants";
import { getCandidateById } from "../services/api";

const buildDownloadUrl = (sourceFile) => {
  if (!sourceFile) {
    return "";
  }
  const origin = API_BASE_URL.replace(/\/api$/, "");
  return `${origin}/uploads/${encodeURIComponent(sourceFile)}`;
};

const CandidateProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");

    getCandidateById(id)
      .then((data) => {
        if (isMounted) {
          setCandidate(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.response?.data?.error || err.message || "Failed to load candidate.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const downloadUrl = useMemo(
    () => buildDownloadUrl(candidate?.sourceFile),
    [candidate?.sourceFile]
  );

  const handleCopy = async (value) => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      setError("Unable to copy to clipboard.");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading candidate...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-sm text-slate-500">
        Candidate not found.
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ml-2 text-sm font-semibold text-slate-700"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Candidate profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {candidate.fullName || "Unnamed candidate"}
            </h1>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>{candidate.email || "Email not provided"}</p>
              <p>{candidate.phone || "Phone not provided"}</p>
              <p>
                {candidate.experienceYears ?? "-"} years experience
              </p>
              <p>
                {candidate.designation || "Designation not set"}
                {candidate.currentCompany ? ` · ${candidate.currentCompany}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleCopy(candidate.email)}
              disabled={!candidate.email}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Copy email
            </button>
            <button
              type="button"
              onClick={() => handleCopy(candidate.phone)}
              disabled={!candidate.phone}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Copy phone
            </button>
            <a
              href={downloadUrl || "#"}
              className={`rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white ${
                downloadUrl ? "" : "pointer-events-none opacity-60"
              }`}
            >
              Download Excel
            </a>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Details</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.isArray(candidate.skills) && candidate.skills.length ? (
                  candidate.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No skills listed.</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Location</p>
              <p className="mt-2">{candidate.location || "Not specified"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Source file</p>
              <p className="mt-2">{candidate.sourceFile || "Unknown"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Raw data</h2>
            <button
              type="button"
              onClick={() => setRawOpen((prev) => !prev)}
              className="text-sm font-semibold text-slate-600"
            >
              {rawOpen ? "Hide" : "Show"}
            </button>
          </div>
          {rawOpen ? (
            <div className="mt-4 max-h-[400px] space-y-3 overflow-y-auto text-sm text-slate-700">
              {candidate.rawData && Object.keys(candidate.rawData).length ? (
                Object.entries(candidate.rawData).map(([key, value]) => (
                  <div key={key} className="border-b border-slate-100 pb-2">
                    <p className="text-xs font-semibold uppercase text-slate-400">{key}</p>
                    <p className="mt-1 break-words">
                      {value !== null && value !== undefined ? String(value) : "-"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No raw data available.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Expand to see the original Excel fields.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default CandidateProfile;
