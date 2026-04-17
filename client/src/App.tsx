import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Runs from "./pages/Runs";
import RunDetails from "./pages/RunDetails";
import RunDiff from "./pages/RunDiff";
import Licenses from "./pages/Licenses";
import Login from "./pages/Login";
import Settings from "./pages/Settings";

import { Protected } from "./Protected";
import { useAuth } from "./auth/AuthContext";

import { AppLayout } from "./AppLayout";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./ui/Button";

function ProtectedShell({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Protected>
      <PageHeader title={title} right={right} />
      {children}
    </Protected>
  );
}

function AuthedRoutes() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedShell title="Dashboard">
                <Dashboard />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs"
            element={
              <ProtectedShell title="Runs">
                <Runs />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs/:id"
            element={
              <ProtectedShell title="Run details">
                <RunDetails />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs/:id/diff"
            element={
              <ProtectedShell title="Diff">
                <RunDiff />
              </ProtectedShell>
            }
          />

          {/* ✅ NEW: Licenses registry */}
          <Route
            path="/licenses"
            element={
              <ProtectedShell title="Licenses registry">
                <Licenses />
              </ProtectedShell>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedShell title="Settings">
                <Settings />
              </ProtectedShell>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

    </AppLayout>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Private */}
      <Route
        path="/*"
        element={user ? <AuthedRoutes /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
