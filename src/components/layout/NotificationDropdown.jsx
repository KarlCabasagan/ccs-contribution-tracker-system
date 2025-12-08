import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Flag,
  UserPlus,
  UserX,
  UserCheck,
  Shield,
  CreditCard,
  Trash2,
  FileUp,
  RotateCcw,
} from "lucide-react";
import { formatTime, formatDateTime } from "../../lib/utils";

export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const mobileDrawerRef = useRef(null);

  // Check if notifications are enabled in preferences
  const notificationsEnabled =
    localStorage.getItem("notifications") !== "false";

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only add if notifications are enabled
          if (notificationsEnabled) {
            setNotifications((prev) => [payload.new, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notificationsEnabled]);

  // Close dropdown when clicking outside (check both desktop and mobile refs)
  useEffect(() => {
    function handleClickOutside(e) {
      const isOutsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(e.target);
      const isOutsideMobileDrawer =
        !mobileDrawerRef.current || !mobileDrawerRef.current.contains(e.target);

      // Only close if click is outside BOTH the dropdown trigger/panel AND the mobile drawer
      if (isOutsideDropdown && isOutsideMobileDrawer) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape & lock body scroll on mobile
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Lock scroll on mobile
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  async function fetchNotifications() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = notifications
        .filter((n) => !n.is_read)
        .map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }

  async function clearAllRead() {
    try {
      const readIds = notifications.filter((n) => n.is_read).map((n) => n.id);
      if (readIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .in("id", readIds);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (error) {
      console.error("Error clearing read notifications:", error);
    }
  }

  async function deleteNotification(e, notificationId) {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }

  function handleNotificationClick(notification) {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Close first (important for mobile)
    setIsOpen(false);

    // Navigate based on notification type
    if (
      notification.type?.includes("user") ||
      notification.type === "new_user_registration" ||
      notification.type === "role_changed_by_others"
    ) {
      // User-related notifications go to users page
      navigate("/users");
    } else if (notification.reference_id) {
      // Transaction notifications go to transactions with highlight
      if (
        notification.type === "student_import" ||
        notification.type === "student_import_reverted"
      ) {
        navigate("/students/import/logs");
      } else {
        navigate(`/transactions?highlight=${notification.reference_id}`);
      }
    }
  }

  function getNotificationIcon(type) {
    // Specific transaction types (for super admin notifications)
    if (type === "transaction_verified") {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (type === "transaction_rejected") {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (type === "transaction_flagged") {
      return <Flag className="w-5 h-5 text-orange-500" />;
    }
    if (type === "transaction_new") {
      return <CreditCard className="w-5 h-5 text-blue-500" />;
    }
    if (type === "transaction_edited") {
      return <CreditCard className="w-5 h-5 text-purple-500" />;
    }
    if (type === "transaction_pending") {
      return <CreditCard className="w-5 h-5 text-yellow-500" />;
    }
    if (type === "transaction_updated") {
      return <CreditCard className="w-5 h-5 text-slate-500" />;
    }
    // Legacy transaction status icons (for admin notifications)
    if (type?.includes("verified")) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (type?.includes("rejected")) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (type?.includes("flagged")) {
      return <Flag className="w-5 h-5 text-yellow-500" />;
    }
    // Transaction from others (legacy)
    if (type === "transaction_from_others") {
      return <CreditCard className="w-5 h-5 text-blue-500" />;
    }
    // User-related icons
    if (type === "new_user_registration") {
      return <UserPlus className="w-5 h-5 text-purple-500" />;
    }
    if (type === "user_suspended_by_others") {
      return <UserX className="w-5 h-5 text-red-500" />;
    }
    if (type === "user_unsuspended_by_others") {
      return <UserCheck className="w-5 h-5 text-green-500" />;
    }
    if (type === "role_changed_by_others") {
      return <Shield className="w-5 h-5 text-indigo-500" />;
    }
    if (type === "student_import") {
      return <FileUp className="w-5 h-5 text-fuchsia-500" />;
    }
    if (type === "student_import_reverted") {
      return <RotateCcw className="w-5 h-5 text-orange-500" />;
    }
    return <Bell className="w-5 h-5 text-primary-500" />;
  }

  // Render styled message with highlighted key data (universal for all notification types)
  function renderStyledMessage(message) {
    if (!message) return null;

    // Build regex pattern to match all highlightable parts
    // Order matters - more specific patterns first
    const pattern =
      /(\"[^\"]+\"|₱[\d,.]+|for [^(]+ \(|to (?:Super Admin|Admin|User)|^.+? imported students to [^:]+|^.+? reverted import \"[^\"]+\"|by [^.]+\.|By [^.]+\.|Reason: .+$|\+\d+ new|\d+ updated|\d+ deleted|\d+ restored)/gi;

    const parts = message.split(pattern);

    return (
      <span>
        {parts.map((part, i) => {
          if (!part) return null;

          // "username" or "filename" - quoted text (blue)
          if (part.match(/^\"[^\"]+\"$/)) {
            return (
              <span
                key={i}
                className="font-semibold text-primary-600 dark:text-primary-400"
              >
                {part}
              </span>
            );
          }

          // ₱amount - currency amounts (green)
          if (part.match(/^₱[\d,.]+$/)) {
            return (
              <span
                key={i}
                className="font-bold text-green-600 dark:text-green-400"
              >
                {part}
              </span>
            );
          }

          // [Username] imported students to [Semester]
          if (part.match(/ imported students to /i)) {
            const [username, semester] = part.split(/ imported students to /i);
            return (
              <span key={i}>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {username}
                </span>
                {" imported students to "}
                <span className="font-medium text-fuchsia-600 dark:text-fuchsia-400">
                  {semester}
                </span>
              </span>
            );
          }

          // [Username] reverted import "File"
          if (part.match(/ reverted import /i)) {
            const [username, file] = part.split(/ reverted import /i);
            return (
              <span key={i}>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {username}
                </span>
                {" reverted import "}
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {file}
                </span>
              </span>
            );
          }

          // Counts: +X new, Y updated, Z deleted, W restored
          if (part.match(/^\+\d+ new$/)) {
            return (
              <span
                key={i}
                className="font-medium text-green-600 dark:text-green-400"
              >
                {part}
              </span>
            );
          }
          if (part.match(/^\d+ updated$/)) {
            return (
              <span
                key={i}
                className="font-medium text-blue-600 dark:text-blue-400"
              >
                {part}
              </span>
            );
          }
          if (part.match(/^\d+ deleted$/)) {
            return (
              <span
                key={i}
                className="font-medium text-red-600 dark:text-red-400"
              >
                {part}
              </span>
            );
          }
          if (part.match(/^\d+ restored$/)) {
            return (
              <span
                key={i}
                className="font-medium text-blue-600 dark:text-blue-400"
              >
                {part}
              </span>
            );
          }

          // for [student name] ( - student names (blue)
          if (part.match(/^for [^(]+ \($/i)) {
            const name = part.replace(/^for /i, "").replace(/ \($/, "");
            return (
              <span key={i}>
                for{" "}
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {name}
                </span>{" "}
                (
              </span>
            );
          }

          // to [role] - role assignments (cyan)
          if (part.match(/^to (?:Super Admin|Admin|User)$/i)) {
            const role = part.replace(/^to /i, "");
            return (
              <span key={i}>
                to{" "}
                <span className="font-medium text-cyan-600 dark:text-cyan-400">
                  {role}
                </span>
              </span>
            );
          }

          // By [username]. or by [username]. - actor names (purple)
          if (part.match(/^[Bb]y [^.]+\.$/)) {
            const username = part.replace(/^[Bb]y /i, "").replace(/\.$/, "");
            return (
              <span key={i}>
                {part.startsWith("B") ? "By" : "by"}{" "}
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {username}
                </span>
                .
              </span>
            );
          }

          // Reason: xxx - rejection reasons (orange)
          if (part.match(/^Reason: /i)) {
            const reason = part.replace(/^Reason: /i, "");
            return (
              <span key={i}>
                Reason:{" "}
                <span className="italic text-orange-600 dark:text-orange-400">
                  {reason}
                </span>
              </span>
            );
          }

          // Default - no styling
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Shared notification list content
  const notificationContent = (
    <>
      {/* Notification List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400">
              No notifications yet
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`flex items-start gap-3 p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                !notification.is_read
                  ? "bg-primary-50/50 dark:bg-primary-900/10"
                  : ""
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    notification.is_read
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {renderStyledMessage(notification.message)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">
                    {formatDateTime(notification.created_at)}
                  </span>
                  {notification.reference_id && (
                    <span className="flex items-center gap-0.5 text-xs text-primary-500">
                      <ExternalLink className="w-3 h-3" />
                      View
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!notification.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    className="p-1 text-slate-400 hover:text-primary-500 rounded transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => deleteNotification(e, notification.id)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                  title="Delete"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center shrink-0">
          <p className="text-xs text-slate-400">
            Showing latest {notifications.length} notifications
          </p>
        </div>
      )}
    </>
  );

  // Mobile drawer rendered via Portal to escape header's stacking context
  const mobileDrawer = isOpen
    ? createPortal(
        <AnimatePresence>
          <div className="md:hidden fixed inset-0 z-60">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer Panel - ref attached here */}
            <motion.div
              ref={mobileDrawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl flex flex-col"
            >
              {/* Header with close button */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Mark all
                    </button>
                  )}
                  {notifications.some((n) => n.is_read) && (
                    <button
                      onClick={clearAllRead}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close notifications"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {notificationContent}
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop Dropdown (md and up) - rendered inline */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="hidden md:flex flex-col absolute right-0 mt-2 w-96 max-h-[70vh] overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark all
                  </button>
                )}
                {notifications.some((n) => n.is_read) && (
                  <button
                    onClick={clearAllRead}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear read
                  </button>
                )}
              </div>
            </div>

            {notificationContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer - rendered via Portal to document.body */}
      {mobileDrawer}
    </div>
  );
}
