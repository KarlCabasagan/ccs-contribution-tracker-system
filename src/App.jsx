import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PendingVerification } from "./components/auth/PendingVerification";
import { Suspended } from "./components/auth/Suspended";
import { Layout } from "./components/layout/Layout";
import { SuperAdminDashboard } from "./components/dashboard/SuperAdminDashboard";
import { AdminDashboard } from "./components/dashboard/AdminDashboard";
import { TransactionForm } from "./components/transactions/TransactionForm";
import { TransactionHistory } from "./components/transactions/TransactionHistory";
import { StudentList } from "./components/students/StudentList";
import { StudentImporter } from "./components/students/StudentImporter";
import { StudentImportLogs } from "./components/students/StudentImportLogs";
import { SemesterManager } from "./components/semesters/SemesterManager";
import { Reports } from "./components/reports/Reports";
import { Settings } from "./components/settings/Settings";
import { UserManagement } from "./components/users/UserManagement";

function DashboardRedirect() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <SuperAdminDashboard /> : <AdminDashboard />;
}

// Auth-aware route for pending/suspended pages
function AuthStatusRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />

          {/* Auth Status Routes (no Layout, just auth check) */}
          <Route
            path="/pending-verification"
            element={
              <AuthStatusRoute>
                <PendingVerification />
              </AuthStatusRoute>
            }
          />
          <Route
            path="/suspended"
            element={
              <AuthStatusRoute>
                <Suspended />
              </AuthStatusRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardRedirect />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Layout>
                  <TransactionHistory />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/transactions/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <TransactionForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <Layout>
                  <StudentList />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/students/import"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Layout>
                  <StudentImporter />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/students/import/logs"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Layout>
                  <StudentImportLogs />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/semesters"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Layout>
                  <SemesterManager />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Layout>
                  <UserManagement />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
