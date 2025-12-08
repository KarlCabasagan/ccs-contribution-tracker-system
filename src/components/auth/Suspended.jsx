import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "framer-motion";
import { ShieldX, LogOut, User, AlertTriangle, Mail } from "lucide-react";

export function Suspended() {
  const navigate = useNavigate();
  const { user, profile, isActive, needsVerification } = useAuth();
  const [suspendedByUser, setSuspendedByUser] = useState(null);
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

    // If user is no longer suspended, redirect appropriately
    if (isActive) {
      if (needsVerification) {
        navigate("/pending", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [profile, isActive, needsVerification, navigate]);

  // Fetch who suspended this user
  useEffect(() => {
    async function fetchSuspendedBy() {
      if (!profile?.suspended_by) return;

      try {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", profile.suspended_by)
          .single();

        if (data) {
          setSuspendedByUser(data);
        }
      } catch (error) {
        console.error("Error fetching suspended by:", error);
      }
    }

    fetchSuspendedBy();
  }, [profile?.suspended_by]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        darkMode
          ? "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900"
          : "bg-linear-to-br from-red-50 via-white to-slate-100"
      }`}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse ${
            darkMode ? "bg-red-500/20" : "bg-red-200/50"
          }`}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-pulse delay-1000 ${
            darkMode ? "bg-primary-600/20" : "bg-primary-200/50"
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
          {/* Warning icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-linear-to-r from-red-500 to-red-600 flex items-center justify-center">
                <ShieldX className="w-10 h-10 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20" />
            </div>
          </div>

          {/* Title */}
          <h1
            className={`text-2xl font-bold text-center mb-2 ${
              darkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Account Suspended
          </h1>
          <p
            className={`text-center mb-6 ${
              darkMode ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Your access to the system has been revoked
          </p>

          {/* User Info */}
          <div
            className={`rounded-2xl p-4 mb-4 space-y-3 ${
              darkMode
                ? "bg-white/5 border border-white/10"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Account
                </p>
                <p
                  className={`font-medium ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {profile?.username || user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Suspension Reason Card */}
          <div
            className={`rounded-2xl p-4 mb-4 ${
              darkMode
                ? "bg-red-500/10 border border-red-500/30"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  darkMode ? "text-red-400" : "text-red-500"
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium mb-1 ${
                    darkMode ? "text-red-300" : "text-red-700"
                  }`}
                >
                  Reason for Suspension
                </p>
                <p
                  className={`text-sm ${
                    darkMode ? "text-red-200" : "text-red-600"
                  }`}
                >
                  {profile?.suspension_reason || "No reason provided"}
                </p>
              </div>
            </div>
          </div>

          {/* Suspended By */}
          {suspendedByUser?.username && (
            <div
              className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${
                darkMode
                  ? "bg-white/5 border border-white/10"
                  : "bg-slate-50 border border-slate-200"
              }`}
            >
              <span
                className={`text-xs ${
                  darkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Suspended by:
              </span>
              <span
                className={`text-sm font-medium ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {suspendedByUser.username}
              </span>
            </div>
          )}

          {/* Contact message */}
          <div
            className={`rounded-xl p-4 mb-6 ${
              darkMode
                ? "bg-primary-500/10 border border-primary-500/20"
                : "bg-primary-50 border border-primary-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <Mail
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  darkMode ? "text-primary-400" : "text-primary-500"
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium mb-1 ${
                    darkMode ? "text-slate-200" : "text-slate-800"
                  }`}
                >
                  Disagree with this decision?
                </p>
                <p
                  className={`text-sm ${
                    darkMode ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Please contact a Super Admin to discuss your account status
                  and request reinstatement.
                </p>
              </div>
            </div>
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
