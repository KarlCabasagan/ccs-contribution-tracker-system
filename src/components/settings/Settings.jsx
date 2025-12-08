import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  User,
  CreditCard,
  Building2,
  Shield,
  Bell,
  Palette,
  Save,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Moon,
  Sun,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileUp,
} from "lucide-react";

const TABS = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
    color: "text-blue-500",
    superAdminOnly: false,
  },
  {
    id: "paymentMethods",
    label: "Payment Methods",
    icon: CreditCard,
    color: "text-green-500",
    superAdminOnly: true,
  },
  {
    id: "colleges",
    label: "Colleges",
    icon: Building2,
    color: "text-purple-500",
    superAdminOnly: true,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: Palette,
    color: "text-amber-500",
    superAdminOnly: false,
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    color: "text-red-500",
    superAdminOnly: false,
  },
];

// ==================== PROFILE SECTION ====================
function ProfileSection() {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
    }
  }, [profile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", user.id);

      if (error) throw error;
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Profile Settings
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Update your personal information
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter your username"
            />
          </div>
        </div>

        {message.text && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ==================== PAYMENT METHODS SECTION ====================
function PaymentMethodsSection() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  async function fetchPaymentMethods() {
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .order("name");
    setPaymentMethods(data || []);
  }

  async function handleAdd() {
    if (!newPaymentMethod.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("payment_methods")
        .insert({ name: newPaymentMethod.trim() });

      if (error) throw error;
      setNewPaymentMethod("");
      fetchPaymentMethods();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id, name) {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ name })
        .eq("id", id);

      if (error) throw error;
      setEditingId(null);
      fetchPaymentMethods();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleToggle(id, isActive) {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      fetchPaymentMethods();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure? This may affect existing transactions."))
      return;

    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchPaymentMethods();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Payment Methods
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage available payment options
        </p>
      </div>

      {/* Add new payment method */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newPaymentMethod}
          onChange={(e) => setNewPaymentMethod(e.target.value)}
          placeholder="New payment method name..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Method
        </Button>
      </div>

      {/* Payment methods list */}
      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <p className="text-center text-slate-500 py-8">
            No payment methods found. Add one above.
          </p>
        ) : (
          paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 ${
                method.is_active
                  ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60"
              }`}
            >
              {editingId === method.id ? (
                <input
                  type="text"
                  defaultValue={method.name}
                  autoFocus
                  onBlur={(e) => handleUpdate(method.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUpdate(method.id, e.target.value);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              ) : (
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {method.name}
                </span>
              )}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => handleToggle(method.id, method.is_active)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    method.is_active
                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-300"
                  }`}
                >
                  {method.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => setEditingId(method.id)}
                  className="p-2 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(method.id)}
                  className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== COLLEGES SECTION ====================
function CollegesSection() {
  const [colleges, setColleges] = useState([]);
  const [newCollege, setNewCollege] = useState({ name: "", code: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  async function fetchColleges() {
    const { data } = await supabase.from("colleges").select("*").order("name");
    setColleges(data || []);
  }

  async function handleAdd() {
    if (!newCollege.name.trim() || !newCollege.code.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("colleges").insert({
        name: newCollege.name.trim(),
        code: newCollege.code.trim().toUpperCase(),
      });

      if (error) throw error;
      setNewCollege({ name: "", code: "" });
      fetchColleges();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id, name, code) {
    try {
      const { error } = await supabase
        .from("colleges")
        .update({ name, code: code.toUpperCase() })
        .eq("id", id);

      if (error) throw error;
      setEditingId(null);
      fetchColleges();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure? This may affect existing students.")) return;

    try {
      const { error } = await supabase.from("colleges").delete().eq("id", id);

      if (error) throw error;
      fetchColleges();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Colleges
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage colleges and their codes
        </p>
      </div>

      {/* Add new college */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newCollege.name}
          onChange={(e) =>
            setNewCollege({ ...newCollege, name: e.target.value })
          }
          placeholder="College name..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="text"
          value={newCollege.code}
          onChange={(e) =>
            setNewCollege({ ...newCollege, code: e.target.value })
          }
          placeholder="Code (e.g., CCS)"
          className="w-full sm:w-48 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
        />
        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add College
        </Button>
      </div>

      {/* Colleges list */}
      <div className="space-y-3">
        {colleges.length === 0 ? (
          <p className="text-center text-slate-500 py-8">
            No colleges found. Add one above.
          </p>
        ) : (
          colleges.map((college) => (
            <div
              key={college.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 gap-3"
            >
              {editingId === college.id ? (
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    id={`college-name-${college.id}`}
                    defaultValue={college.name}
                    className="flex-1 px-4 py-2 rounded-xl border-2 border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <input
                    type="text"
                    id={`college-code-${college.id}`}
                    defaultValue={college.code}
                    className="w-full sm:w-24 px-4 py-2 rounded-xl border-2 border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none uppercase"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const name = document.getElementById(
                          `college-name-${college.id}`
                        ).value;
                        const code = document.getElementById(
                          `college-code-${college.id}`
                        ).value;
                        handleUpdate(college.id, name, code);
                      }}
                      className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {college.name}
                    </span>
                    <span className="px-3 py-1 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg">
                      {college.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(college.id)}
                      className="p-2 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(college.id)}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== PREFERENCES SECTION ====================
// Notification preference option config
const NOTIFICATION_OPTIONS = [
  {
    key: "transaction_updates",
    label: "My Transaction Updates",
    description: "When your transactions are verified, rejected, or flagged",
    icon: CheckCircle,
    color: "green",
    superAdminOnly: false,
    skipAutoEnableForSuperAdmin: true, // Super admins skip auto-enable on master toggle
  },
  {
    key: "transactions_from_others",
    label: "Transactions from Others",
    description: "When other admins record or update transactions",
    icon: CreditCard,
    color: "blue",
    superAdminOnly: false,
    skipAutoEnableForAdmin: true, // Admins skip auto-enable on master toggle
  },
  {
    key: "self_suspension_actions",
    label: "My Suspension Actions",
    description: "Confirmation when you suspend a user",
    icon: Shield,
    color: "orange",
    superAdminOnly: true,
  },
  {
    key: "new_user_registration",
    label: "New User Registrations",
    description: "When a new user registers and needs role assignment",
    icon: User,
    color: "purple",
    superAdminOnly: true,
  },
  {
    key: "user_suspended_by_others",
    label: "User Suspended by Others",
    description: "When another admin suspends a user",
    icon: AlertCircle,
    color: "red",
    superAdminOnly: true,
  },
  {
    key: "user_unsuspended_by_others",
    label: "User Unsuspended by Others",
    description: "When another admin unsuspends a user",
    icon: CheckCircle,
    color: "teal",
    superAdminOnly: true,
  },
  {
    key: "role_changed_by_others",
    label: "Role Changed by Others",
    description: "When another admin changes a user's role",
    icon: Shield,
    color: "indigo",
    superAdminOnly: true,
  },
  {
    key: "student_imports",
    label: "Student Imports",
    description: "When a student import is completed",
    icon: FileUp,
    color: "fuchsia",
    superAdminOnly: true,
  },
];

function PreferencesSection() {
  const { user, profile } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPrefs, setNotificationPrefs] = useState({
    transaction_updates: true,
    transactions_from_others: true,
    self_suspension_actions: true,
    new_user_registration: true,
    user_suspended_by_others: true,
    user_unsuspended_by_others: true,
    role_changed_by_others: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = profile?.role === "super_admin";

  // Load preferences from Supabase
  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("notification_preferences")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data?.notification_preferences) {
          setNotificationPrefs(data.notification_preferences);
          // Check if all prefs are false = master toggle off
          const anyEnabled = Object.values(data.notification_preferences).some(
            (v) => v === true
          );
          setNotificationsEnabled(anyEnabled);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  // Load dark mode from localStorage
  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
  }, []);

  // Sync dark mode with header toggle
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

  function handleToggleDarkMode() {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  async function savePreferencesToSupabase(newPrefs) {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: newPrefs })
        .eq("id", user.id);

      if (error) throw error;

      // Also update localStorage for NotificationDropdown compatibility
      const anyEnabled = Object.values(newPrefs).some((v) => v === true);
      localStorage.setItem("notifications", anyEnabled.toString());
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  }

  function handleMasterToggle() {
    const newEnabled = !notificationsEnabled;
    setNotificationsEnabled(newEnabled);

    // If turning off, disable all. If turning on, enable selectively based on role.
    const newPrefs = {};
    NOTIFICATION_OPTIONS.forEach((opt) => {
      if (newEnabled) {
        // Check if this option should skip auto-enable for current role
        const skipForAdmin = !isSuperAdmin && opt.skipAutoEnableForAdmin;
        const skipForSuperAdmin =
          isSuperAdmin && opt.skipAutoEnableForSuperAdmin;
        newPrefs[opt.key] = !(skipForAdmin || skipForSuperAdmin);
      } else {
        newPrefs[opt.key] = false;
      }
    });
    setNotificationPrefs(newPrefs);
    savePreferencesToSupabase(newPrefs);
  }

  function handleIndividualToggle(key) {
    const newPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(newPrefs);

    // Check if any are still enabled
    const anyEnabled = Object.values(newPrefs).some((v) => v === true);
    setNotificationsEnabled(anyEnabled);

    savePreferencesToSupabase(newPrefs);
  }

  function getColorClasses(color, enabled) {
    const colors = {
      green: enabled
        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      blue: enabled
        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      orange: enabled
        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      purple: enabled
        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      red: enabled
        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      teal: enabled
        ? "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
      indigo: enabled
        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-400",
    };
    return colors[color] || colors.green;
  }

  // Filter options based on role
  const visibleOptions = NOTIFICATION_OPTIONS.filter(
    (opt) => !opt.superAdminOnly || isSuperAdmin
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Preferences
        </h2>
        <p className="text-sm text-slate-500 mt-1">Customize your experience</p>
      </div>

      <div className="space-y-4">
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                darkMode
                  ? "bg-indigo-100 dark:bg-indigo-900/30"
                  : "bg-amber-100 dark:bg-amber-900/30"
              }`}
            >
              {darkMode ? (
                <Moon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Sun className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Dark Mode
              </p>
              <p className="text-sm text-slate-500">
                Use dark theme for better viewing at night
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleDarkMode}
            className={`relative shrink-0 w-14 h-8 rounded-full transition-all duration-300 ${
              darkMode ? "bg-primary-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute left-0 top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                darkMode ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Notifications Master Toggle with Expandable Sub-options */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  notificationsEnabled
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <Bell
                  className={`w-6 h-6 transition-colors duration-300 ${
                    notificationsEnabled
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-400"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Notifications
                  </p>
                  {saving && (
                    <span className="text-xs text-primary-500 animate-pulse">
                      Saving...
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {notificationsEnabled
                    ? "Click to expand and customize notification types"
                    : "Enable to receive alerts and customize preferences"}
                </p>
              </div>
            </div>
            <button
              onClick={handleMasterToggle}
              disabled={loading}
              className={`relative shrink-0 w-14 h-8 rounded-full transition-all duration-300 ${
                notificationsEnabled
                  ? "bg-primary-500"
                  : "bg-slate-300 dark:bg-slate-600"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`absolute left-0 top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                  notificationsEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Expandable Sub-options with smooth animation */}
          <motion.div
            initial={false}
            animate={{
              height: notificationsEnabled ? "auto" : 0,
              opacity: notificationsEnabled ? 1 : 0,
            }}
            transition={{
              height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2, delay: notificationsEnabled ? 0.1 : 0 },
            }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Notification Types
              </p>
              <div className="space-y-2">
                {visibleOptions.map((option, index) => {
                  const Icon = option.icon;
                  const isEnabled = notificationPrefs[option.key];
                  return (
                    <motion.div
                      key={option.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                        isEnabled
                          ? "bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700"
                          : "bg-transparent hover:bg-white/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${getColorClasses(
                            option.color,
                            isEnabled
                          )}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm font-medium transition-colors duration-200 ${
                                isEnabled
                                  ? "text-slate-700 dark:text-slate-200"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {option.label}
                            </p>
                            {option.superAdminOnly && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                Super Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleIndividualToggle(option.key)}
                        disabled={loading || saving}
                        className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 ${
                          isEnabled
                            ? "bg-primary-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        } ${
                          loading || saving
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                            isEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => {
                    const allOn = {};
                    visibleOptions.forEach((opt) => {
                      // Respect skip auto-enable flags based on role
                      const skipForAdmin =
                        !isSuperAdmin && opt.skipAutoEnableForAdmin;
                      const skipForSuperAdmin =
                        isSuperAdmin && opt.skipAutoEnableForSuperAdmin;
                      allOn[opt.key] = !(skipForAdmin || skipForSuperAdmin);
                    });
                    setNotificationPrefs(allOn);
                    savePreferencesToSupabase(allOn);
                  }}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                >
                  Enable All
                </button>
                <button
                  onClick={() => {
                    const allOff = {};
                    visibleOptions.forEach((opt) => (allOff[opt.key] = false));
                    setNotificationPrefs(allOff);
                    setNotificationsEnabled(false);
                    savePreferencesToSupabase(allOff);
                  }}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  Disable All
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mascot Settings - Only for Primary Super Admin */}
      {profile?.is_first_admin && <MascotSettings />}
    </div>
  );
}

// ==================== MASCOT SETTINGS ====================
function MascotSettings() {
  const { profile } = useAuth();

  // Default settings
  const defaultSettings = {
    enabled: true,
    showWelcome: true,
    mobileAutoOpen: true,
    idleTimeout: 30,
    autoMessageInterval: 120,
  };

  // Initialize from profile (database) or localStorage fallback
  const [settings, setSettings] = useState(() => {
    // Try profile first (from database)
    if (profile?.mascot_settings) {
      return { ...defaultSettings, ...profile.mascot_settings };
    }
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem("mascotSettings");
      return stored
        ? { ...defaultSettings, ...JSON.parse(stored) }
        : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [saving, setSaving] = useState(false);

  // Sync with profile changes
  useEffect(() => {
    if (profile?.mascot_settings) {
      setSettings((prev) => ({
        ...defaultSettings,
        ...profile.mascot_settings,
      }));
    }
  }, [profile?.mascot_settings]);

  async function updateSetting(key, value) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Update localStorage immediately for responsive UI
    localStorage.setItem("mascotSettings", JSON.stringify(newSettings));
    window.dispatchEvent(new Event("mascotSettingsChanged"));

    // Save to database
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ mascot_settings: newSettings })
        .eq("id", profile.id);

      if (error) {
        console.error("Error saving mascot settings:", error);
      }
    } catch (err) {
      console.error("Error saving mascot settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    setSettings(defaultSettings);
    localStorage.setItem("mascotSettings", JSON.stringify(defaultSettings));
    window.dispatchEvent(new Event("mascotSettingsChanged"));

    // Save to database
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ mascot_settings: defaultSettings })
        .eq("id", profile.id);

      if (error) {
        console.error("Error resetting mascot settings:", error);
      }
    } catch (err) {
      console.error("Error resetting mascot settings:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-pink-100 dark:bg-pink-900/30">
          <span className="text-2xl">🐾</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Karl the Mascot
          </p>
          <p className="text-sm text-slate-500">
            Customize your mascot companion
          </p>
        </div>
        {saving && (
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="space-y-4">
        {/* Enabled Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Enable Mascot
            </p>
            <p className="text-xs text-slate-500">Show Karl in the corner</p>
          </div>
          <button
            onClick={() => updateSetting("enabled", !settings.enabled)}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-all duration-300 ${
              settings.enabled
                ? "bg-primary-500"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Show Welcome Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Welcome Message
            </p>
            <p className="text-xs text-slate-500">
              Greet on login (1-hour cooldown)
            </p>
          </div>
          <button
            onClick={() => updateSetting("showWelcome", !settings.showWelcome)}
            disabled={!settings.enabled}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-all duration-300 ${
              settings.showWelcome && settings.enabled
                ? "bg-primary-500"
                : "bg-slate-300 dark:bg-slate-600"
            } ${!settings.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                settings.showWelcome ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Mobile Auto Open Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Mobile Auto-Open
            </p>
            <p className="text-xs text-slate-500">
              Open menu for welcome on mobile
            </p>
          </div>
          <button
            onClick={() =>
              updateSetting("mobileAutoOpen", !settings.mobileAutoOpen)
            }
            disabled={!settings.enabled || !settings.showWelcome}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-all duration-300 ${
              settings.mobileAutoOpen &&
              settings.enabled &&
              settings.showWelcome
                ? "bg-primary-500"
                : "bg-slate-300 dark:bg-slate-600"
            } ${
              !settings.enabled || !settings.showWelcome
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            <span
              className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                settings.mobileAutoOpen ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Idle Timeout Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Idle Timeout
            </p>
            <span className="text-sm font-mono text-primary-500">
              {settings.idleTimeout}s
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={settings.idleTimeout}
            onChange={(e) =>
              updateSetting("idleTimeout", parseInt(e.target.value))
            }
            disabled={!settings.enabled}
            className={`w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500 ${
              !settings.enabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          <p className="text-xs text-slate-500">
            Seconds before idle emote (10-120s)
          </p>
        </div>

        {/* Auto Message Interval Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Auto Message Interval
            </p>
            <span className="text-sm font-mono text-primary-500">
              {Math.floor(settings.autoMessageInterval / 60)}m{" "}
              {settings.autoMessageInterval % 60}s
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="300"
            step="30"
            value={settings.autoMessageInterval}
            onChange={(e) =>
              updateSetting("autoMessageInterval", parseInt(e.target.value))
            }
            disabled={!settings.enabled}
            className={`w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500 ${
              !settings.enabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          <p className="text-xs text-slate-500">
            Seconds between auto messages (60-300s)
          </p>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetToDefaults}
          className="w-full text-sm px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// ==================== SECURITY SECTION ====================
function SecuritySection() {
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;
      setMessage({ type: "success", text: "Password updated successfully!" });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Security
        </h2>
        <p className="text-sm text-slate-500 mt-1">Change your password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value,
                  })
                }
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {message.text && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            variant="danger"
            className="w-full md:w-auto flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ==================== MAIN SETTINGS COMPONENT ====================
export function Settings() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Filter tabs based on role - admins can't see Payment Methods or Colleges
  const visibleTabs = TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your account and system preferences
        </p>
      </div>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2 min-w-max pb-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary-500 text-white shadow-lg"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden lg:block w-64 shrink-0">
          <Card className="sticky top-24 p-2">
            <nav className="space-y-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                      isActive
                        ? "bg-primary-500 text-white shadow-md"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-white" : tab.color
                      }`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Content Panel */}
        <div className="flex-1">
          <Card className="p-6">
            {activeTab === "profile" && <ProfileSection />}
            {activeTab === "paymentMethods" && <PaymentMethodsSection />}
            {activeTab === "colleges" && <CollegesSection />}
            {activeTab === "preferences" && <PreferencesSection />}
            {activeTab === "security" && <SecuritySection />}
          </Card>
        </div>
      </div>
    </div>
  );
}
