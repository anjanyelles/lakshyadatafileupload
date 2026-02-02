import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NavBar = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {/* Laksya */}
            Dishha
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Recruitment DB
          </h2>
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold text-slate-600">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "text-slate-900" : "hover:text-slate-900"
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) =>
              isActive ? "text-slate-900" : "hover:text-slate-900"
            }
          >
            Upload
          </NavLink>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Alpha
          </span>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Logout
            </button>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? "text-slate-900" : "hover:text-slate-900"
              }
            >
              Login
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
};

export default NavBar;
