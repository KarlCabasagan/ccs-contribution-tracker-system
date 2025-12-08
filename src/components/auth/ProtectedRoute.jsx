import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const {
    isAuthenticated,
    isSuperAdmin,
    isActive,
    isSuspended,
    needsVerification,
    loading,
  } = useAuth();

  // Check dark mode from localStorage for loading screen
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    return false;
  });

  // Ensure dark class is applied during loading
  useEffect(() => {
    if (loading && isDark) {
      document.documentElement.classList.add("dark");
    }
  }, [loading, isDark]);

  // Show premium loading screen while checking auth
  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors ${
          isDark
            ? "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900"
            : "bg-linear-to-br from-slate-100 via-slate-200 to-slate-100"
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-blue-400 border-b-transparent rounded-full animate-spin animate-reverse" />
          </div>
          <p
            className={`font-medium ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in -> login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Suspended users -> suspended page
  if (isSuspended) {
    return <Navigate to="/suspended" replace />;
  }

  // Users with 'user' role (unverified) -> pending verification page
  if (needsVerification) {
    return <Navigate to="/pending-verification" replace />;
  }

  // Super admin required but user is not super admin
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
