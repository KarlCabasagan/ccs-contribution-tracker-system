import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Plus, Calendar, Edit3, Search, AlertTriangle } from "lucide-react";

export function SemesterManager() {
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editingSemester, setEditingSemester] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    contribution_amount: "",
  });

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingActivationSemester, setPendingActivationSemester] =
    useState(null);

  useEffect(() => {
    fetchSemesters();

    // Real-time subscription for semesters
    const channel = supabase
      .channel("semesters-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "semesters" },
        () => fetchSemesters()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchSemesters() {
    try {
      const { data, error } = await supabase
        .from("semesters")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      // CRITICAL: Only SET state, never UPDATE database on mount
      setSemesters(data || []);
    } catch (error) {
      console.error("Error fetching semesters:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter semesters by search and status
  const filteredSemesters = useMemo(() => {
    return semesters.filter((sem) => {
      // Search filter
      if (
        searchQuery &&
        !sem.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Status filter
      if (filterStatus === "active" && !sem.is_active) return false;
      if (filterStatus === "archived" && sem.is_active) return false;

      return true;
    });
  }, [semesters, searchQuery, filterStatus]);

  // Check if there's an active semester
  const activeSemester = semesters.find((s) => s.is_active);
  const canCreateNew = !activeSemester;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const { error } = await supabase.from("semesters").insert({
        ...formData,
        contribution_amount: parseFloat(formData.contribution_amount),
      });

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        contribution_amount: "",
      });
      fetchSemesters();
    } catch (error) {
      alert("Error creating semester: " + error.message);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("semesters")
        .update({
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          contribution_amount: parseFloat(formData.contribution_amount),
        })
        .eq("id", editingSemester.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setEditingSemester(null);
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        contribution_amount: "",
      });
      fetchSemesters();
    } catch (error) {
      alert("Error updating semester: " + error.message);
    }
  }

  function openEditModal(semester) {
    setEditingSemester(semester);
    setFormData({
      name: semester.name,
      start_date: semester.start_date,
      end_date: semester.end_date,
      contribution_amount: semester.contribution_amount.toString(),
    });
    setIsEditModalOpen(true);
  }

  // Handle activation with confirmation modal
  function handleActivateClick(semester) {
    // If trying to activate and there's already an active semester
    if (!semester.is_active && activeSemester) {
      setPendingActivationSemester(semester);
      setIsConfirmModalOpen(true);
    } else {
      // No active semester or deactivating - proceed directly
      toggleActive(semester);
    }
  }

  // Confirm activation from modal
  function confirmActivation() {
    if (pendingActivationSemester) {
      toggleActive(pendingActivationSemester);
    }
    setIsConfirmModalOpen(false);
    setPendingActivationSemester(null);
  }

  // Cancel activation
  function cancelActivation() {
    setIsConfirmModalOpen(false);
    setPendingActivationSemester(null);
  }

  async function toggleActive(semester) {
    try {
      const { error } = await supabase
        .from("semesters")
        .update({ is_active: !semester.is_active })
        .eq("id", semester.id);

      if (error) throw error;
      fetchSemesters();
    } catch (error) {
      alert("Error updating semester: " + error.message);
    }
  }

  function handleSemesterClick(semester, e) {
    // Prevent navigation if clicking a button or its child elements
    const target = e.target;

    // Check if click is on a button or inside a button
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return;
    }

    // Navigate logic:
    // If active semester -> go to /students (clean URL)
    // If inactive/archived -> go to /students?semesterId=...
    if (semester.is_active) {
      navigate("/students");
    } else {
      navigate(`/students?semesterId=${semester.id}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Semester Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage semester periods and contribution amounts
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center"
          disabled={!canCreateNew}
          title={
            !canCreateNew
              ? "Deactivate the current semester before creating a new one"
              : ""
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          New Semester
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search semester name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Semesters</option>
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
          </select>
        </div>
      </Card>

      {/* Semester Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="loading-shimmer h-48 rounded-xl" />
            ))
          : filteredSemesters.map((semester) => (
              <div
                key={semester.id}
                onClick={(e) => handleSemesterClick(semester, e)}
                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all ${
                  semester.is_active ? "border-2 border-primary-500" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 flex-1 mr-2">
                    {semester.name}
                  </h3>
                  {/* Status Badge - Always show */}
                  {semester.is_active ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 shrink-0">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 shrink-0">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(semester.start_date).toLocaleDateString()} -{" "}
                      {new Date(semester.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-4">
                    ₱{parseFloat(semester.contribution_amount).toFixed(2)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(semester);
                    }}
                    className="flex-1 flex items-center justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant={semester.is_active ? "danger" : "secondary"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActivateClick(semester);
                    }}
                    className="flex-1"
                  >
                    {semester.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
      </div>

      {!loading && filteredSemesters.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No semesters found</p>
            {searchQuery && (
              <p className="text-sm mt-2">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Create Semester Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Semester"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Semester Name"
            placeholder="e.g. 1st Semester 2024-2025"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            type="date"
            label="Start Date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
            required
          />
          <Input
            type="date"
            label="End Date"
            value={formData.end_date}
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
            required
          />
          <Input
            type="number"
            label="Contribution Amount"
            placeholder="0.00"
            step="0.01"
            min="0"
            value={formData.contribution_amount}
            onChange={(e) =>
              setFormData({ ...formData, contribution_amount: e.target.value })
            }
            required
          />
          <Button type="submit" className="w-full">
            Create Semester
          </Button>
        </form>
      </Modal>

      {/* Edit Semester Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSemester(null);
        }}
        title="Edit Semester"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Semester Name"
            placeholder="e.g. 1st Semester 2024-2025"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            type="date"
            label="Start Date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
            required
          />
          <Input
            type="date"
            label="End Date"
            value={formData.end_date}
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
            required
          />
          <Input
            type="number"
            label="Contribution Amount"
            placeholder="0.00"
            step="0.01"
            min="0"
            value={formData.contribution_amount}
            onChange={(e) =>
              setFormData({ ...formData, contribution_amount: e.target.value })
            }
            required
          />
          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Confirmation Modal for Activation */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={cancelActivation}
        title="Confirm Activation"
      >
        <div className="space-y-4">
          {/* Warning Icon & Message */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Activating{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {pendingActivationSemester?.name}
                </strong>{" "}
                will automatically deactivate{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {activeSemester?.name}
                </strong>
                .
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Do you want to continue?
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={cancelActivation}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={confirmActivation} className="flex-1">
              Confirm Activate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
