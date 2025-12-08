import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { MobileMenu } from "./MobileMenu";
import { NotificationDropdown } from "./NotificationDropdown";
import { Mascot, canShowWelcome } from "./Mascot";
import {
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  Receipt,
  Users,
  UserCog,
  BookOpen,
  FileText,
  Settings,
  Menu,
} from "lucide-react";

// Import logos
import logoDark from "../../assets/contribution-tracker-logo-dark.png";
import logoLight from "../../assets/contribution-tracker-logo-light.png";

export function Layout({ children }) {
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, profile, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Auto-open mobile menu for primary super admin welcome message
  useEffect(() => {
    if (profile?.is_first_admin) {
      // Check welcome cooldown first - don't open menu if cooldown hasn't passed
      if (!canShowWelcome()) return;

      // Get mascot settings from profile (database) or localStorage (fallback)
      let mascotSettings = profile?.mascot_settings;
      if (!mascotSettings) {
        try {
          mascotSettings = JSON.parse(
            localStorage.getItem("mascotSettings") || "{}"
          );
        } catch (e) {
          mascotSettings = {};
        }
      }

      const enabled = mascotSettings.enabled !== false;
      const showWelcome = mascotSettings.showWelcome !== false;
      const mobileAutoOpen = mascotSettings.mobileAutoOpen !== false;

      if (!enabled || !showWelcome || !mobileAutoOpen) return;

      // Check if mobile view (md breakpoint = 768px)
      const isMobileView = window.innerWidth < 768;
      if (isMobileView) {
        // Delay to let the page load first
        setTimeout(() => {
          setIsMobileMenuOpen(true);
        }, 500);
      }
    }
  }, [profile?.is_first_admin, profile?.mascot_settings]);

  // Sync dark mode with Settings toggle (listen for DOM class changes)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setDarkMode(isDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  function toggleDarkMode() {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  async function handleLogout() {
    const { supabase } = await import("../../lib/supabase");
    await supabase.auth.signOut();
    navigate("/login");
  }

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/transactions", label: "Transactions", icon: Receipt },
    { path: "/students", label: "Students", icon: Users },
    {
      path: "/semesters",
      label: "Semesters",
      icon: BookOpen,
      requireSuperAdmin: true,
    },
    {
      path: "/reports",
      label: "Reports",
      icon: FileText,
      requireSuperAdmin: true,
    },
    {
      path: "/users",
      label: "Users",
      icon: UserCog,
      requireSuperAdmin: true,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src={darkMode ? logoDark : logoLight}
                alt="CCS Tracker Logo"
                className="w-10 h-10 object-cover"
              />
              <div>
                <h1 className="text-xl font-bold gradient-text">CCS Tracker</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile?.username || user?.email}
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                if (item.requireSuperAdmin && !isSuperAdmin) return null;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                        isActive
                          ? "bg-primary-500 text-white shadow-lg"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              <NotificationDropdown />

              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>

              {/* Mobile Menu Trigger - Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>

      {/* Mascot for Primary Super Admin - Desktop only */}
      {profile?.is_first_admin && (
        <div className="hidden md:block">
          <Mascot profileSettings={profile?.mascot_settings} />
        </div>
      )}

      {/* Mobile Menu - Rendered at root level for proper z-index stacking */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        navItems={navItems}
        profileSettings={profile?.mascot_settings}
      />
    </div>
  );
}
