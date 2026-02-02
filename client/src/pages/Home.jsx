import { useEffect, useState } from "react";
import { getCandidates } from "../services/api";

const Home = () => {
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");

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
                  <p className="text-sm font-semibold text-slate-900">
                    {candidate.fullName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {candidate.role || "Role not set"} · {candidate.email}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </section>
  );
};

export default Home;
