import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchCandidates } from "../services/api";

const DEFAULT_LIMIT = 20;
const DEBOUNCE_MS = 400;

const buildSkillQuery = (skills) => {
  if (!skills.length) {
    return "";
  }
  return skills.map((skill) => skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
};

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [text, setText] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [expMin, setExpMin] = useState(0);
  const [expMax, setExpMax] = useState(20);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const paramText = searchParams.get("text");
    if (paramText) {
      setText(paramText);
      setPage(1);
    }
  }, [searchParams]);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / DEFAULT_LIMIT), 1), [total]);

  const queryParams = useMemo(
    () => ({
      text: text.trim() || undefined,
      skill: buildSkillQuery(skills),
      location: location.trim() || undefined,
      company: company.trim() || undefined,
      expMin,
      expMax,
      page,
      limit: DEFAULT_LIMIT,
    }),
    [text, skills, location, company, expMin, expMax, page]
  );

  const fetchResults = async (params) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await searchCandidates(params);
      setResults(response.candidates || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchResults(queryParams);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [queryParams]);

  const handleSearchClick = () => {
    fetchResults(queryParams);
  };

  const handleSkillAdd = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (skills.includes(trimmed)) {
      setSkillInput("");
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
    setPage(1);
  };

  const handleSkillRemove = (value) => {
    setSkills((prev) => prev.filter((skill) => skill !== value));
    setPage(1);
  };

  const sortedResults = useMemo(() => {
    const items = [...results];
    items.sort((a, b) => {
      if (sort.key === "experience") {
        const left = a.experienceYears || 0;
        const right = b.experienceYears || 0;
        return sort.direction === "asc" ? left - right : right - left;
      }
      const left = `${a.fullName || ""}`.toLowerCase();
      const right = `${b.fullName || ""}`.toLowerCase();
      if (left === right) {
        return 0;
      }
      const comparison = left.localeCompare(right);
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return items;
  }, [results, sort]);

  const handleExport = () => {
    if (!results.length) {
      return;
    }
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Experience",
      "Skills",
      "Location",
      "Company",
    ];
    const rows = results.map((candidate) => [
      candidate.fullName || "",
      candidate.email || "",
      candidate.phone || "",
      candidate.experienceYears ?? "",
      Array.isArray(candidate.skills) ? candidate.skills.join(", ") : "",
      candidate.location || "",
      candidate.currentCompany || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => toCsvValue(value)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "candidates.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Candidate Search
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Find the right talent</h1>
        <p className="text-base text-slate-600">
          Search by skills, experience, location, or company.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Full-text search</label>
            <input
              type="text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPage(1);
              }}
              placeholder="Name, email, phone, skills"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
              placeholder="City or region"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Company</label>
            <input
              type="text"
              value={company}
              onChange={(event) => {
                setCompany(event.target.value);
                setPage(1);
              }}
              placeholder="Current company"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Skills</label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillRemove(skill)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {skill} ✕
                </button>
              ))}
              <input
                type="text"
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    handleSkillAdd(skillInput);
                  }
                }}
                placeholder="Type skill and press Enter"
                className="flex-1 border-none text-sm outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Experience min</label>
            <input
              type="range"
              min="0"
              max="30"
              value={expMin}
              onChange={(event) => {
                const value = Number(event.target.value);
                setExpMin(Math.min(value, expMax));
                setPage(1);
              }}
              className="w-full"
            />
            <p className="text-xs text-slate-500">{expMin} years</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Experience max</label>
            <input
              type="range"
              min="0"
              max="30"
              value={expMax}
              onChange={(event) => {
                const value = Number(event.target.value);
                setExpMax(Math.max(value, expMin));
                setPage(1);
              }}
              className="w-full"
            />
            <p className="text-xs text-slate-500">{expMax} years</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSearchClick}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Results</h2>
            <p className="text-sm text-slate-600">
              {total} candidates · Page {page} of {totalPages}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSort((prev) => ({
                  key: "name",
                  direction: prev.direction === "asc" ? "desc" : "asc",
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Sort by name
            </button>
            <button
              type="button"
              onClick={() =>
                setSort((prev) => ({
                  key: "experience",
                  direction: prev.direction === "asc" ? "desc" : "asc",
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Sort by experience
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 text-sm text-slate-500">Loading results...</div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : sortedResults.length === 0 ? (
          <div className="mt-6 text-sm text-slate-500">No candidates found.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="border-b border-slate-200 pb-2">Name</th>
                  <th className="border-b border-slate-200 pb-2">Email</th>
                  <th className="border-b border-slate-200 pb-2">Phone</th>
                  <th className="border-b border-slate-200 pb-2">Experience</th>
                  <th className="border-b border-slate-200 pb-2">Skills</th>
                  <th className="border-b border-slate-200 pb-2">Location</th>
                  <th className="border-b border-slate-200 pb-2">Company</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((candidate) => (
                  <tr
                    key={candidate._id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/candidates/${candidate._id}`)}
                  >
                    <td className="py-3 font-semibold text-slate-900">
                      {candidate.fullName || "-"}
                    </td>
                    <td className="py-3 text-slate-700">{candidate.email || "-"}</td>
                    <td className="py-3 text-slate-700">{candidate.phone || "-"}</td>
                    <td className="py-3 text-slate-700">
                      {candidate.experienceYears ?? "-"}
                    </td>
                    <td className="py-3 text-slate-700">
                      {Array.isArray(candidate.skills)
                        ? candidate.skills.join(", ")
                        : "-"}
                    </td>
                    <td className="py-3 text-slate-700">{candidate.location || "-"}</td>
                    <td className="py-3 text-slate-700">
                      {candidate.currentCompany || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default SearchPage;
