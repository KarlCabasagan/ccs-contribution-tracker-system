import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  Crown,
  UserX,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar,
  Copy,
  Check,
  Archive,
} from "lucide-react";
import { formatDate } from "../../lib/utils";

const ROLE_OPTIONS = [
  { value: "user", label: "User", color: "slate", icon: Users },
  { value: "admin", label: "Admin", color: "blue", icon: Shield },
  {
    value: "super_admin",
    label: "Super Admin",
    color: "purple",
    icon: ShieldCheck,
  },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const ARCHIVE_FILTER_OPTIONS = [
  { value: "not_archived", label: "Active Users" },
  { value: "archived", label: "Archived Users" },
  { value: "all", label: "All Users" },
];

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super Admins" },
];

export function UserManagement() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [emailMap, setEmailMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedEmail, setCopiedEmail] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState("not_archived");

  // Suspend modal state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);

  // Role change dropdown (portal-based)
  const [openRoleDropdown, setOpenRoleDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [updatingRole, setUpdatingRole] = useState(null);
  const dropdownButtonRefs = useRef({});

  // Expandable row state (only one can be expanded)
  const [expandedUserId, setExpandedUserId] = useState(null);

  useEffect(() => {
    fetchUsers();

    // Real-time subscription for live updates
    const channel = supabase
      .channel("users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          // Handle real-time updates without full refresh
          if (payload.eventType === "UPDATE") {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === payload.new.id ? { ...u, ...payload.new } : u
              )
            );
          } else if (payload.eventType === "INSERT") {
            fetchUsers(); // New user, need full refresh for email
          } else if (payload.eventType === "DELETE") {
            setUsers((prev) => prev.filter((u) => u.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close dropdown on scroll or resize
  useEffect(() => {
    function handleScrollOrResize() {
      setOpenRoleDropdown(null);
    }

    if (openRoleDropdown) {
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [openRoleDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (openRoleDropdown) {
        const buttonRef = dropdownButtonRefs.current[openRoleDropdown];
        if (buttonRef && !buttonRef.contains(e.target)) {
          // Check if clicking inside the dropdown portal
          const dropdown = document.getElementById("role-dropdown-portal");
          if (!dropdown || !dropdown.contains(e.target)) {
            setOpenRoleDropdown(null);
          }
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openRoleDropdown]);

  async function fetchUsers() {
    try {
      setLoading(true);

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch emails from auth.users via RPC
      const { data: emailsData, error: emailsError } = await supabase.rpc(
        "get_user_emails"
      );

      // Build email map (even if RPC fails, continue with empty map)
      const emails = {};
      if (!emailsError && emailsData) {
        emailsData.forEach((e) => {
          emails[e.id] = e.email;
        });
      }
      setEmailMap(emails);

      // Build username map for role_set_by and suspended_by lookups
      const usernameMap = {};
      profilesData.forEach((p) => {
        usernameMap[p.id] = p.username;
      });

      // Enrich profiles with resolved usernames
      const enrichedProfiles = profilesData.map((p) => ({
        ...p,
        role_set_by_username: p.role_set_by ? usernameMap[p.role_set_by] : null,
        suspended_by_username: p.suspended_by
          ? usernameMap[p.suspended_by]
          : null,
        unsuspended_by_username: p.unsuspended_by
          ? usernameMap[p.unsuspended_by]
          : null,
      }));

      setUsers(enrichedProfiles);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }

  function openDropdown(userId) {
    const buttonEl = dropdownButtonRefs.current[userId];
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      const dropdownHeight = 140; // Approximate height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < dropdownHeight;

      setDropdownPosition({
        top: goUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpenRoleDropdown(userId);
  }

  async function updateUserRole(userId, newRole) {
    if (updatingRole) return;

    try {
      setUpdatingRole(userId);

      // Optimistic update - immediately update UI
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: newRole,
                role_set_by: currentUser.id,
                role_set_by_username: currentProfile?.username,
              }
            : u
        )
      );
      setOpenRoleDropdown(null);

      const { error } = await supabase
        .from("profiles")
        .update({
          role: newRole,
          role_set_by: currentUser.id,
        })
        .eq("id", userId);

      if (error) {
        // Rollback on error
        fetchUsers();
        throw error;
      }
    } catch (error) {
      alert("Error updating role: " + error.message);
    } finally {
      setUpdatingRole(null);
    }
  }

  function openSuspendModal(user) {
    setSuspendingUser(user);
    setSuspensionReason("");
    setShowSuspendModal(true);
  }

  async function handleSuspendUser(e) {
    e.preventDefault();
    if (!suspendingUser || !suspensionReason.trim()) return;

    try {
      setSuspendSubmitting(true);

      // Optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === suspendingUser.id
            ? {
                ...u,
                status: "suspended",
                suspension_reason: suspensionReason.trim(),
                suspended_by: currentUser.id,
                suspended_by_username: currentProfile?.username,
              }
            : u
        )
      );

      setShowSuspendModal(false);
      setSuspendingUser(null);
      setSuspensionReason("");

      const { error } = await supabase
        .from("profiles")
        .update({
          status: "suspended",
          suspension_reason: suspensionReason.trim(),
          suspended_by: currentUser.id,
        })
        .eq("id", suspendingUser.id);

      if (error) {
        fetchUsers(); // Rollback
        throw error;
      }
    } catch (error) {
      alert("Error suspending user: " + error.message);
    } finally {
      setSuspendSubmitting(false);
    }
  }

  async function unsuspendUser(userId) {
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                status: "active",
                suspension_reason: null,
                suspended_by: null,
                suspended_by_username: null,
                unsuspended_by: currentUser.id,
                unsuspended_by_username: currentProfile?.username,
                is_archived: false, // Auto-unarchive when unsuspending
              }
            : u
        )
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          status: "active",
          suspension_reason: null,
          suspended_by: null,
          unsuspended_by: currentUser.id,
          is_archived: false, // Auto-unarchive when unsuspending
        })
        .eq("id", userId);

      if (error) {
        fetchUsers(); // Rollback
        throw error;
      }
    } catch (error) {
      alert("Error unsuspending user: " + error.message);
    }
  }

  async function copyEmail(email) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  async function archiveUser(userId) {
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_archived: true } : u))
      );

      const { error } = await supabase
        .from("profiles")
        .update({ is_archived: true })
        .eq("id", userId);

      if (error) {
        fetchUsers();
        throw error;
      }
    } catch (error) {
      alert("Error archiving user: " + error.message);
    }
  }

  async function unarchiveUser(userId) {
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_archived: false } : u))
      );

      const { error } = await supabase
        .from("profiles")
        .update({ is_archived: false })
        .eq("id", userId);

      if (error) {
        fetchUsers();
        throw error;
      }
    } catch (error) {
      alert("Error unarchiving user: " + error.message);
    }
  }

  function canModifyUser(targetUser) {
    if (targetUser.id === currentUser.id) return false;
    if (targetUser.is_first_admin) return false;
    return true;
  }

  function getAvatarClass(role) {
    switch (role) {
      case "super_admin":
        return "bg-gradient-to-r from-primary-500 to-purple-500";
      case "admin":
        return "bg-primary-500";
      case "user":
      default:
        return "bg-primary-900";
    }
  }

  function getRoleBadge(role, isFirstAdmin) {
    const roleConfig =
      ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[0];
    const Icon = roleConfig.icon;

    const colorClasses = {
      slate:
        "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
      blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      purple:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          colorClasses[roleConfig.color]
        }`}
      >
        {isFirstAdmin ? (
          <Crown className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
        {roleConfig.label}
        {isFirstAdmin && (
          <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded text-[10px]">
            Primary
          </span>
        )}
      </span>
    );
  }

  function getStatusBadge(status) {
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Suspended
      </span>
    );
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    const email = emailMap[u.id] || "";
    const matchesSearch =
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    const matchesArchive =
      archiveFilter === "all" ||
      (archiveFilter === "archived" && u.is_archived) ||
      (archiveFilter === "not_archived" && !u.is_archived);
    return matchesSearch && matchesRole && matchesStatus && matchesArchive;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            User Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage user roles and access permissions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div
        className={`grid grid-cols-2 md:grid-cols-${
          users.some((u) => u.is_archived) ? "5" : "4"
        } gap-4`}
      >
        <Card className="p-4 glass text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {users.length}
          </p>
          <p className="text-sm text-slate-500">Total Users</p>
        </Card>
        <Card className="p-4 glass text-center">
          <p className="text-2xl font-bold text-blue-600">
            {users.filter((u) => u.role === "admin").length}
          </p>
          <p className="text-sm text-slate-500">Admins</p>
        </Card>
        <Card className="p-4 glass text-center">
          <p className="text-2xl font-bold text-purple-600">
            {users.filter((u) => u.role === "super_admin").length}
          </p>
          <p className="text-sm text-slate-500">Super Admins</p>
        </Card>
        <Card className="p-4 glass text-center">
          <p className="text-2xl font-bold text-amber-600">
            {users.filter((u) => u.role === "user").length}
          </p>
          <p className="text-sm text-slate-500">Pending</p>
        </Card>
        {users.some((u) => u.is_archived) && (
          <Card className="p-4 glass text-center">
            <p className="text-2xl font-bold text-slate-500">
              {users.filter((u) => u.is_archived).length}
            </p>
            <p className="text-sm text-slate-500">Archived</p>
          </Card>
        )}
      </div>

      {/* Role Dropdown Portal */}
      {createPortal(
        <AnimatePresence>
          {openRoleDropdown && (
            <motion.div
              key="role-dropdown"
              id="role-dropdown-portal"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "fixed",
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                zIndex: 9999,
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[140px]"
            >
              {ROLE_OPTIONS.map((role) => {
                const targetUser = users.find((u) => u.id === openRoleDropdown);
                return (
                  <button
                    key={role.value}
                    onClick={() => updateUserRole(openRoleDropdown, role.value)}
                    disabled={updatingRole === openRoleDropdown}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors ${
                      targetUser?.role === role.value
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <role.icon className="w-4 h-4" />
                    {role.label}
                    {targetUser?.role === role.value && (
                      <Check className="w-3 h-3 ml-auto" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Filters */}
      <Card className="p-4 glass">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ROLE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={archiveFilter}
            onChange={(e) => setArchiveFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ARCHIVE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="glass overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-8"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredUsers.map((u) => {
                  const userEmail = emailMap[u.id] || u.id.slice(0, 8) + "...";
                  const isExpanded = expandedUserId === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                          isExpanded ? "bg-slate-50 dark:bg-slate-800/50" : ""
                        } ${
                          u.is_archived
                            ? "opacity-60 bg-slate-100 dark:bg-slate-900/50"
                            : ""
                        }`}
                        onClick={() =>
                          setExpandedUserId(isExpanded ? null : u.id)
                        }
                      >
                        {/* Expand Icon */}
                        <td className="pl-4 py-3 w-8">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-primary-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </td>

                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full ${getAvatarClass(
                                u.role
                              )} flex items-center justify-center text-white font-bold shrink-0 text-sm`}
                            >
                              {u.username?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">
                                {u.username || "No username"}
                                {u.id === currentUser.id && (
                                  <span className="ml-2 text-xs text-primary-500">
                                    (You)
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[150px]">
                                  {userEmail}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyEmail(emailMap[u.id] || u.id);
                                  }}
                                  className="p-0.5 hover:text-primary-500 transition-colors shrink-0"
                                  title="Copy email"
                                >
                                  {copiedEmail === (emailMap[u.id] || u.id) ? (
                                    <Check className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role with dropdown */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canModifyUser(u) ? (
                            <button
                              ref={(el) =>
                                (dropdownButtonRefs.current[u.id] = el)
                              }
                              onClick={() =>
                                openRoleDropdown === u.id
                                  ? setOpenRoleDropdown(null)
                                  : openDropdown(u.id)
                              }
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                              disabled={updatingRole === u.id}
                            >
                              {getRoleBadge(u.role, u.is_first_admin)}
                              <ChevronDown
                                className={`w-3 h-3 text-slate-400 transition-transform ${
                                  openRoleDropdown === u.id ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          ) : (
                            getRoleBadge(u.role, u.is_first_admin)
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {getStatusBadge(u.status)}
                        </td>

                        {/* Joined */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(u.created_at)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td
                          className="px-4 py-3 text-right flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canModifyUser(u) && (
                            <>
                              {u.status === "active" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSuspendModal(u)}
                                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 flex items-center justify-center gap-1"
                                >
                                  <UserX className="w-4 h-4" />
                                  Suspend
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unsuspendUser(u.id)}
                                  className="text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20 flex items-center justify-center gap-1"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Unsuspend
                                </Button>
                              )}
                              {u.status === "suspended" && !u.is_archived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => archiveUser(u.id)}
                                  className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-700 flex items-center justify-center gap-1 ml-2"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </Button>
                              )}
                              {u.is_archived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unarchiveUser(u.id)}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1 ml-2"
                                >
                                  <Archive className="w-4 h-4" />
                                  Unarchive
                                </Button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50 dark:bg-slate-800/30">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              {/* Role Set By */}
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Role Set By
                                </p>
                                {u.is_first_admin ? (
                                  <span className="text-sm text-slate-400 italic">
                                    System
                                  </span>
                                ) : u.role_set_by_username ? (
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {u.role_set_by_username}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>

                              {/* Suspended By */}
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Suspended By
                                </p>
                                {u.status === "suspended" &&
                                u.suspended_by_username ? (
                                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                    {u.suspended_by_username}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>

                              {/* Unsuspended By */}
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Unsuspended By
                                </p>
                                {u.status === "active" &&
                                u.unsuspended_by_username ? (
                                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                    {u.unsuspended_by_username}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>

                              {/* Suspension Reason */}
                              {u.status === "suspended" &&
                                u.suspension_reason && (
                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                      Suspension Reason
                                    </p>
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                      {u.suspension_reason}
                                    </p>
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Suspend Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend User"
      >
        <form onSubmit={handleSuspendUser} className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">
                Suspend {suspendingUser?.username}?
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">
                This user will be logged out and unable to access the system.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason for Suspension <span className="text-red-500">*</span>
            </label>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Enter the reason for suspending this user..."
              rows={3}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowSuspendModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-500 hover:bg-red-600"
              disabled={!suspensionReason.trim() || suspendSubmitting}
            >
              {suspendSubmitting ? "Suspending..." : "Suspend User"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
