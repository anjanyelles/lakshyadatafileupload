import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Upload = lazy(() => import("./pages/UploadPage.jsx"));
const Uploads = lazy(() => import("./pages/Uploads.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Search = lazy(() => import("./pages/SearchPage.jsx"));
const CandidateProfile = lazy(() => import("./pages/CandidateProfile.jsx"));

const App = () => {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Suspense
          fallback={<div className="text-sm text-slate-500">Loading page...</div>}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/candidates/:id" element={<CandidateProfile />} />
            </Route>
            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="/upload" element={<Upload />} />
              <Route path="/uploads" element={<Uploads />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;
