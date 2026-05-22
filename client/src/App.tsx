import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Runs from "./pages/Runs";
import RunDetails from "./pages/RunDetails";
import RunDiff from "./pages/RunDiff";
import Licenses from "./pages/Licenses";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import AlertsPage from "./pages/AlertsPage";
import Imports from "./pages/Imports";
import Dictionaries from "./pages/Dictionaries";
import DictionariesProducts from "./pages/DictionariesProducts";
import DictionariesMapping from "./pages/DictionariesMapping";
import ClientLicenses from "./pages/ClientLicenses";
import AdminAuditLog from "./pages/AdminAuditLog";

import { Protected } from "./Protected";
import { useAuth } from "./auth/AuthContext";

import { AppLayout } from "./AppLayout";
import { PageHeader } from "./components/PageHeader";

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

function LoginShell() {
  return (
    <AppLayout>
      <Login />
    </AppLayout>
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
              <ProtectedShell title="Обзор">
                <Dashboard />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs"
            element={
              <ProtectedShell title="Запуски">
                <Runs />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs/:id"
            element={
              <ProtectedShell title="Детали запусков">
                <RunDetails />
              </ProtectedShell>
            }
          />

          <Route
            path="/runs/:id/diff"
            element={
              <ProtectedShell title="Сравнение запусков">
                <RunDiff />
              </ProtectedShell>
            }
          />

          <Route
            path="/licenses"
            element={
              <ProtectedShell title="Реестр лицензий">
                <Licenses />
              </ProtectedShell>
            }
          />

          <Route
            path="/client-licenses"
            element={
              <ProtectedShell title="Клиентские лицензии">
                <ClientLicenses />
              </ProtectedShell>
            }
          />

          <Route
            path="/imports"
            element={
              <ProtectedShell title="Импорты">
                <Imports />
              </ProtectedShell>
            }
          />

          <Route
            path="/alerts"
            element={
              <ProtectedShell title="Уведомления">
                <AlertsPage />
              </ProtectedShell>
            }
          />

          <Route
            path="/dictionaries"
            element={<Navigate to="/dictionaries/products" replace />}
          />

          <Route
            path="/dictionaries/products"
            element={
              <ProtectedShell title="Справочники">
                <Dictionaries>
                  <DictionariesProducts />
                </Dictionaries>
              </ProtectedShell>
            }
          />

          <Route
            path="/dictionaries/mapping"
            element={
              <ProtectedShell title="Справочники">
                <Dictionaries>
                  <DictionariesMapping />
                </Dictionaries>
              </ProtectedShell>
            }
          />

          <Route
            path="/admin-audit-log"
            element={
              <ProtectedShell title="Журнал действий">
                <AdminAuditLog />
              </ProtectedShell>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedShell title="Настройки">
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
      <Route path="/login" element={<LoginShell />} />

      {/* Private */}
      <Route
        path="/*"
        element={user ? <AuthedRoutes /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
