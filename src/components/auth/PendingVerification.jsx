import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "framer-motion";
import { Clock, LogOut, User, Mail, Shield } from "lucide-react";

export function PendingVerification() {
  const navigate = useNavigate();
  const { user, profile, isSuspended, needsVerification } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  // Detect dark mode - initialize from localStorage
  useEffect(() => {
    // Check localStorage first, then current class
    const storedDark = localStorage.getItem("darkMode") === "true";
    const classDark = document.documentElement.classList.contains("dark");
    const isDark = storedDark || classDark;

    setDarkMode(isDark);

    // Apply dark class if localStorage says dark but class not set
    if (storedDark && !classDark) {
      document.documentElement.classList.add("dark");
    }

    const observer = new MutationObserver(() => {
      setDarkMode(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Real-time redirect when status/role changes
  useEffect(() => {
    if (!profile) return;

    // If user gets suspended, redirect to suspended page
    if (isSuspended) {
      navigate("/suspended", { replace: true });
      return;
    }

    // If user role changed (no longer "user"), redirect to dashboard
    if (!needsVerification) {
      navigate("/", { replace: true });
    }
  }, [profile, isSuspended, needsVerification, navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        darkMode
          ? "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900"
          : "bg-linear-to-br from-primary-50 via-white to-blue-50"
      }`}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse ${
            darkMode ? "bg-primary-500/20" : "bg-primary-200/50"
          }`}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-pulse delay-1000 ${
            darkMode ? "bg-blue-500/20" : "bg-blue-200/50"
          }`}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div
          className={`backdrop-blur-xl rounded-3xl p-8 shadow-2xl ${
            darkMode
              ? "bg-white/10 border border-white/20"
              : "bg-white/80 border border-slate-200"
          }`}
        >
          {/* Animated waiting indicator */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-linear-to-r from-primary-500 to-blue-500 flex items-center justify-center">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary-400 animate-ping opacity-20" />
              <div className="absolute inset-0 rounded-full border-2 border-primary-300 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h1
            className={`text-2xl font-bold text-center mb-2 ${
              darkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Verification Pending
          </h1>
          <p
            className={`text-center mb-8 ${
              darkMode ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Your account is awaiting approval from a Super Admin
          </p>

          {/* User Info Card */}
          <div
            className={`rounded-2xl p-4 mb-6 space-y-3 ${
              darkMode
                ? "bg-white/5 border border-white/10"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-r from-primary-500 to-purple-500 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Username
                </p>
                <p
                  className={`font-medium ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {profile?.username || "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Email
                </p>
                <p
                  className={`font-medium ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Status
                </p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${
                    darkMode
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Awaiting Verification
                </span>
              </div>
            </div>
          </div>

          {/* Info message */}
          <div
            className={`rounded-xl p-4 mb-6 ${
              darkMode
                ? "bg-primary-500/10 border border-primary-500/20"
                : "bg-primary-50 border border-primary-200"
            }`}
          >
            <p
              className={`text-sm text-center ${
                darkMode ? "text-primary-200" : "text-primary-700"
              }`}
            >
              Once verified, you'll be able to access the CCS Contribution
              Tracker system. Please wait for a Super Admin to review your
              account.
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] ${
              darkMode
                ? "bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                : "bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900"
            }`}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <p
          className={`text-center text-sm mt-6 ${
            darkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          CCS Contribution Tracker
        </p>
      </motion.div>
    </div>
  );
}
