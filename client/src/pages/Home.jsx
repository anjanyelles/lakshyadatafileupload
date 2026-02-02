import { useEffect, useState } from "react";
import { getCandidates, updateCandidateStage } from "../services/api";

const Home = () => {
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const stageOptions = [
    "",
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

  useEffect(() => {
    let isMounted = true;

    getCandidates()
      .then((data) => {
        if (isMounted) {
          setCandidates(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Unable to load candidates.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStageChange = async (candidateId, nextStage) => {
    setSavingId(candidateId);
    setError("");
    try {
      const updated = await updateCandidateStage(candidateId, nextStage);
      setCandidates((prev) =>
        prev.map((candidate) =>
          candidate._id === candidateId ? updated : candidate
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to update stage.");
    } finally {
      setSavingId("");
    }
  };

  const buildDetails = (candidate) => {
    const baseDetails = [
      ["Email", candidate.email || "-"],
      ["Phone", candidate.phone || "-"],
      ["Location", candidate.location || "-"],
      ["Experience", candidate.experienceYears ?? "-"],
      ["Designation", candidate.designation || "-"],
      ["Company", candidate.currentCompany || "-"],
      ["Source file", candidate.sourceFile || "-"],
      ["Job status", candidate.rawData?.Status || "-"],
      [
        "Skills",
        Array.isArray(candidate.skills) && candidate.skills.length
          ? candidate.skills.join(", ")
          : "-",
      ],
      ["Stage", candidate.interviewStage || "Stage not set"],
    ];

    const rawEntries = candidate.rawData
      ? Object.entries(candidate.rawData).map(([key, value]) => [
          key,
          value !== null && value !== undefined ? String(value) : "-",
        ])
      : [];

    return [...baseDetails, ...rawEntries];
  };

  const renderDetailGrid = (candidate) => (
    <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2 lg:grid-cols-3">
      {buildDetails(candidate).map(([label, value]) => (
        <p key={`${label}-${String(value)}`}>
          <span className="font-semibold text-slate-500">{label}:</span> {value}
        </p>
      ))}
    </div>
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Recruitment Database
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Candidate overview
        </h1>
        <p className="text-base text-slate-600">
          Track candidates, roles, and pipeline activity from a single source of truth.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 text-sm font-medium text-slate-700">
            Recent candidates
          </div>
          <ul className="divide-y divide-slate-200">
            {candidates.length === 0 ? (
              <li className="px-5 py-6 text-sm text-slate-500">
                No candidates yet. Add your first profile through the API.
              </li>
            ) : (
              candidates.map((candidate) => (
                <li key={candidate._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidate(candidate)}
                      className="text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {candidate.fullName ||
                          candidate.rawData?.["Candidate Name"] ||
                          "Unnamed candidate"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.designation || "Designation not set"}
                      </p>
                    </button>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{candidate.interviewStage || "Stage not set"}</span>
                      <select
                        value={candidate.interviewStage || ""}
                        onChange={(event) =>
                          handleStageChange(candidate._id, event.target.value)
                        }
                        disabled={savingId === candidate._id}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {stageOptions.map((stage) => (
                          <option key={stage || "none"} value={stage}>
                            {stage ? stage.replace(/_/g, " ") : "Select stage"}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Candidate details
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedCandidate.fullName ||
                    selectedCandidate.rawData?.["Candidate Name"] ||
                    "Unnamed candidate"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4">{renderDetailGrid(selectedCandidate)}</div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Home;
