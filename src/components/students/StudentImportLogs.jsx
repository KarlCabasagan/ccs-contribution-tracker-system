import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
  FileSpreadsheet,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle,
  Edit3,
  AlertCircle,
  RotateCcw,
  Eye,
} from "lucide-react";

export function StudentImportLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [revertingLog, setRevertingLog] = useState(null);
  const [reverting, setReverting] = useState(false);
  const [showRevertEntries, setShowRevertEntries] = useState(false);
  const [revertEntries, setRevertEntries] = useState([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("student_import_logs")
        .select(
          `
          *,
          imported_by_profile:profiles!imported_by (username),
          semesters (name)
        `
        )
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching import logs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEntries(logId) {
    if (expandedLog === logId) {
      setExpandedLog(null);
      setEntries([]);
      return;
    }

    try {
      setEntriesLoading(true);
      setExpandedLog(logId);

      const { data, error } = await supabase
        .from("student_import_entries")
        .select("*")
        .eq("import_log_id", logId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching import entries:", error);
    } finally {
      setEntriesLoading(false);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getChangedFields(oldData, newData) {
    if (!oldData) return [];
    const changes = [];
    const fields = [
      "full_name",
      "major",
      "year_level",
      "department",
      "college_id",
    ];

    fields.forEach((field) => {
      if (oldData[field] !== newData[field]) {
        changes.push({
          field,
          old: oldData[field] || "(empty)",
          new: newData[field] || "(empty)",
        });
      }
    });

    return changes;
  }

  async function fetchRevertEntries(log) {
    const { data, error } = await supabase
      .from("student_import_entries")
      .select("*")
      .eq("import_log_id", log.id)
      .order("action", { ascending: true });

    if (!error) {
      setRevertEntries(data || []);
    }
  }

  async function revertImport(log) {
    try {
      setReverting(true);

      // Fetch all entries for this log
      const { data: allEntries, error: entriesError } = await supabase
        .from("student_import_entries")
        .select("*")
        .eq("import_log_id", log.id);

      if (entriesError) throw entriesError;

      // Process each entry
      for (const entry of allEntries || []) {
        if (entry.action === "inserted") {
          // Delete the inserted student
          await supabase
            .from("students")
            .delete()
            .eq("student_id", entry.student_id);
        } else if (entry.action === "updated" && entry.old_data) {
          // Restore to old data
          await supabase
            .from("students")
            .update({
              full_name: entry.old_data.full_name,
              major: entry.old_data.major,
              year_level: entry.old_data.year_level,
              department: entry.old_data.department,
              college_id: entry.old_data.college_id,
            })
            .eq("student_id", entry.student_id);
        }
      }

      // Mark log as reverted
      await supabase
        .from("student_import_logs")
        .update({
          is_reverted: true,
          reverted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      // Create notifications for super admins
      try {
        // Get current user's username
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user?.id)
          .single();

        // Get super admins with student_imports enabled
        const { data: superAdmins } = await supabase
          .from("profiles")
          .select("id, notification_preferences")
          .eq("role", "super_admin")
          .eq("status", "active");

        const notificationsToCreate = [];
        const currentUsername = currentProfile?.username || "Unknown";

        superAdmins?.forEach((admin) => {
          if (admin.id === user?.id) return;
          const prefs = admin.notification_preferences || {};
          if (prefs.student_imports === false) return;

          notificationsToCreate.push({
            user_id: admin.id,
            type: "student_import_reverted",
            message: `${currentUsername} reverted import "${log.file_name}": ${log.inserted_count} deleted, ${log.updated_count} restored`,
            reference_id: log.id,
          });
        });

        if (notificationsToCreate.length > 0) {
          await supabase.from("notifications").insert(notificationsToCreate);
        }
      } catch (notifErr) {
        console.error("Error creating revert notifications:", notifErr);
      }

      // Refresh logs
      await fetchLogs();
      setRevertingLog(null);
      setExpandedLog(null);
      setEntries([]);
      setShowRevertEntries(false);
      setRevertEntries([]);
    } catch (error) {
      console.error("Error reverting import:", error);
      alert("Failed to revert import: " + error.message);
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Import Logs</h1>
          <p className="text-slate-600 dark:text-slate-400">
            History of student imports
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/students/import")}
          className="flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Import
        </Button>
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="loading-shimmer h-24 rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No import logs found</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => fetchEntries(log.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.file_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {log.imported_by_profile?.username || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(log.created_at)}
                        </span>
                        <span>{log.semesters?.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Stats */}
                    <div className="flex gap-3 text-sm">
                      {log.is_reverted ? (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Reverted
                        </span>
                      ) : (
                        <>
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            +{log.inserted_count} new
                          </span>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            {log.updated_count} updated
                          </span>
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                            {log.unchanged_count} unchanged
                          </span>
                          {log.error_count > 0 && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              {log.error_count} errors
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Revert Button */}
                    {!log.is_reverted &&
                      (log.inserted_count > 0 || log.updated_count > 0) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevertingLog(log);
                          }}
                          className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Revert
                        </button>
                      )}

                    {expandedLog === log.id ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Entries */}
              {expandedLog === log.id && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                  {entriesLoading ? (
                    <div className="p-4">
                      <div className="loading-shimmer h-20 rounded-lg" />
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No changes recorded for this import
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                              Action
                            </th>
                            <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                              Student ID
                            </th>
                            <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            >
                              <td className="px-4 py-2">
                                {entry.action === "inserted" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    Inserted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                    <Edit3 className="w-3 h-3" />
                                    Updated
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 font-mono text-slate-900 dark:text-slate-100">
                                {entry.student_id}
                              </td>
                              <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                                {entry.new_data?.full_name}
                              </td>
                              <td className="px-4 py-2">
                                {entry.action === "updated" ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEntry(entry);
                                    }}
                                    className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                                  >
                                    View changes
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-xs">
                                    New student
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Changes Detail Modal */}
      <Modal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Student Update Details"
      >
        {selectedEntry && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedEntry.new_data?.full_name}
              </p>
              <p className="text-sm text-slate-500">
                {selectedEntry.student_id}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">
                Changes Made:
              </h4>
              {getChangedFields(selectedEntry.old_data, selectedEntry.new_data)
                .length === 0 ? (
                <p className="text-sm text-slate-500">
                  No field changes detected
                </p>
              ) : (
                <div className="space-y-2">
                  {getChangedFields(
                    selectedEntry.old_data,
                    selectedEntry.new_data
                  ).map((change, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700"
                    >
                      <p className="text-xs text-slate-500 uppercase mb-1">
                        {change.field.replace("_", " ")}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="line-through text-red-600 dark:text-red-400">
                          {change.old}
                        </span>
                        <span>→</span>
                        <span className="text-green-600 dark:text-green-400">
                          {change.new}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={() => setSelectedEntry(null)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* Revert Confirmation Modal */}
      <Modal
        isOpen={!!revertingLog}
        onClose={() => setRevertingLog(null)}
        title="Revert Import"
      >
        {revertingLog && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-orange-900 dark:text-orange-100">
                    Are you sure you want to revert this import?
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    This action cannot be undone. The following changes will be
                    made:
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {revertingLog.inserted_count > 0 && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {revertingLog.inserted_count} students will be DELETED
                  </span>
                </div>
              )}
              {revertingLog.updated_count > 0 && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {revertingLog.updated_count} students will be restored to
                    previous data
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>File:</strong> {revertingLog.file_name}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <strong>Imported:</strong> {formatDate(revertingLog.created_at)}
              </p>
            </div>

            {/* View Changes Toggle */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!showRevertEntries && revertEntries.length === 0) {
                    fetchRevertEntries(revertingLog);
                  }
                  setShowRevertEntries(!showRevertEntries);
                }}
                className="w-full flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
              >
                <Eye className="w-4 h-4" />
                {showRevertEntries
                  ? "Hide Changes"
                  : "View Changes to be Reverted"}
              </Button>
            </div>

            {/* Changes Preview */}
            {showRevertEntries && (
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                {revertEntries.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Loading changes...
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          Action
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          Student
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {revertEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="bg-white dark:bg-slate-900"
                        >
                          <td className="px-3 py-2">
                            {entry.action === "inserted" ? (
                              <span className="text-red-600 dark:text-red-400 text-xs font-medium">
                                Will be Deleted
                              </span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">
                                Will be Restored
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            <div>{entry.new_data?.full_name}</div>
                            <div className="text-xs text-slate-500">
                              {entry.student_id}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setRevertingLog(null)}
                className="flex-1"
                disabled={reverting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => revertImport(revertingLog)}
                loading={reverting}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Revert Import
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
