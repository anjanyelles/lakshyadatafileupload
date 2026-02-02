import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCandidateStats, getUploads } from "../services/api";

const EXPERIENCE_BUCKETS = [
  { label: "0-2", min: 0, max: 2 },
  { label: "2-5", min: 2, max: 5 },
  { label: "5-10", min: 5, max: 10 },
  { label: "10+", min: 10, max: 100 },
];

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

const parseBucketRange = (label) => {
  if (!label) {
    return null;
  }
  if (label === "50+") {
    return { min: 50, max: 100 };
  }
  const numeric = Number(label);
  if (!Number.isNaN(numeric)) {
    return { min: numeric, max: numeric + 0.999 };
  }
  return null;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");

    Promise.all([getCandidateStats(), getUploads({ page: 1, limit: 10 })])
      .then(([statsResponse, uploadsResponse]) => {
        if (!isMounted) {
          return;
        }
        setStats(statsResponse);
        setUploads(uploadsResponse.data || []);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        setError(err.response?.data?.error || err.message || "Failed to load dashboard.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const experienceChart = useMemo(() => {
    const source = stats?.byExperience || [];
    const parsed = source
      .map((entry) => ({
        range: entry.range,
        count: entry.count || 0,
        parsed: parseBucketRange(entry.range),
      }))
      .filter((entry) => entry.parsed);

    return EXPERIENCE_BUCKETS.map((bucket) => {
      const count = parsed.reduce((sum, entry) => {
        if (!entry.parsed) {
          return sum;
        }
        if (entry.parsed.min >= bucket.min && entry.parsed.min < bucket.max) {
          return sum + entry.count;
        }
        return sum;
      }, 0);
      return { label: bucket.label, count };
    });
  }, [stats]);

  const skillsChart = useMemo(
    () =>
      (stats?.bySkills || []).slice(0, 10).map((entry) => ({
        label: entry.skill,
        count: entry.count || 0,
      })),
    [stats]
  );

  const locationsChart = useMemo(
    () =>
      (stats?.byLocation || []).slice(0, 10).map((entry) => ({
        label: entry.location,
        count: entry.count || 0,
      })),
    [stats]
  );

  const handleQuickSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (query) {
      navigate(`/search?text=${encodeURIComponent(query)}`);
    } else {
      navigate("/search");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Overview
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-base text-slate-600">
          Key recruitment metrics and recent activity.
        </p>
      </header>

      <form
        onSubmit={handleQuickSearch}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Quick search by name, email, or skill"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Total candidates</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {stats?.totalCandidates || 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Recent uploads</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {stats?.recentUploads || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Last 7 days</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase text-slate-400">
            Candidates by experience
          </p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={experienceChart}>
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-400">Top skills</p>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillsChart} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="label" type="category" width={120} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#334155" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-400">Top locations</p>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationsChart} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="label" type="category" width={120} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#475569" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
            <p className="text-sm text-slate-600">Latest 10 uploads</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/uploads")}
            className="text-sm font-semibold text-slate-700"
          >
            View all
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {uploads.length === 0 ? (
            <div className="text-sm text-slate-500">No uploads yet.</div>
          ) : (
            uploads.map((entry) => (
              <div
                key={entry._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{entry.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>
                    {entry.processedRows || 0}/{entry.totalRows || 0} rows
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                      entry.status
                    )}`}
                  >
                    {entry.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
