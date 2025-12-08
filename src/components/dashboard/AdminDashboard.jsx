import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { formatCurrency, formatDate, debounce } from "../../lib/utils";
import {
  Users,
  DollarSign,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  X,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Chart colors
const COLORS = {
  paid: "#22c55e",
  partial: "#eab308",
  unpaid: "#ef4444",
};

// Helper function to format status text properly
function formatStatusText(status) {
  if (!status) return "";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper function to get responsive text size based on value length
function getMetricTextSize(value) {
  const len = String(value).length;
  if (len > 10) return "text-lg";
  if (len > 7) return "text-xl";
  return "text-2xl";
}

// Helper: Fetch all rows bypassing 1000 limit
async function fetchAllRows(tableName, selectQuery, filters = {}) {
  const BATCH_SIZE = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectQuery)
      .range(from, from + BATCH_SIZE - 1);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// =============================================================================
// EXTRACTED: RecordTransactionModal Component (Same as SuperAdmin)
// =============================================================================
const RecordTransactionModal = memo(function RecordTransactionModal({
  isOpen,
  onClose,
  selectedSemesterId,
  semesterName,
  contributionAmount,
  onSuccess,
}) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [gcashRefId, setGcashRefId] = useState("");
  const [bulkGcashRefs, setBulkGcashRefs] = useState({});
  const [transactionAmount, setTransactionAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasPartialStudent, setHasPartialStudent] = useState(false);
  const [partialRemainingAmount, setPartialRemainingAmount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedStudents([]);
      setPaymentMethod("cash");
      setGcashRefId("");
      setBulkGcashRefs({});
      setTransactionAmount("");
      setAmountError("");
      setIsSearching(false);
      setHasPartialStudent(false);
      setPartialRemainingAmount(0);
    } else {
      fetchPaymentMethods();
    }
  }, [isOpen]);

  useEffect(() => {
    const partialStudent = selectedStudents.find(
      (s) => s.totalPaid > 0 && s.totalPaid < contributionAmount
    );
    setHasPartialStudent(!!partialStudent);
    if (partialStudent) {
      setPartialRemainingAmount(contributionAmount - partialStudent.totalPaid);
    } else {
      setPartialRemainingAmount(0);
    }
  }, [selectedStudents, contributionAmount]);

  async function fetchPaymentMethods() {
    try {
      const { data } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true);
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  }

  function getPaymentMethodId(methodName) {
    const method = paymentMethods.find(
      (m) => m.name.toLowerCase() === methodName.toLowerCase()
    );
    return method?.id || null;
  }

  const performSearch = useCallback(
    debounce(async (query, semesterId, selectedIds) => {
      if (!query.trim() || !semesterId) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        const { data: studentsData } = await supabase
          .from("students")
          .select(
            `
            student_id,
            full_name,
            semester_enrollments!inner (semester_id)
          `
          )
          .eq("semester_enrollments.semester_id", semesterId)
          .or(`full_name.ilike.%${query}%,student_id.ilike.%${query}%`)
          .limit(10);

        const { data: txData } = await supabase
          .from("transactions")
          .select("student_id, amount")
          .eq("semester_id", semesterId)
          .eq("verification_status", "verified");

        const paidMap = {};
        (txData || []).forEach((tx) => {
          if (!paidMap[tx.student_id]) paidMap[tx.student_id] = 0;
          paidMap[tx.student_id] += parseFloat(tx.amount);
        });

        const enrichedStudents = studentsData.map((s) => ({
          ...s,
          totalPaid: paidMap[s.student_id] || 0,
          isFullyPaid: (paidMap[s.student_id] || 0) >= contributionAmount,
          isPartial:
            (paidMap[s.student_id] || 0) > 0 &&
            (paidMap[s.student_id] || 0) < contributionAmount,
        }));

        const filtered = enrichedStudents.filter(
          (s) => !selectedIds.has(s.student_id)
        );

        setSearchResults(filtered.slice(0, 5));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [contributionAmount]
  );

  function handleSearchChange(e) {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      const selectedIds = new Set(selectedStudents.map((s) => s.student_id));
      performSearch(query, selectedSemesterId, selectedIds);
    } else {
      setSearchResults([]);
    }
  }

  function canAddStudent(student) {
    if (student.isFullyPaid) return false;
    if (hasPartialStudent) return false;
    if (student.isPartial && selectedStudents.length > 0) return false;
    return true;
  }

  function addStudent(student) {
    if (!canAddStudent(student)) return;
    setSelectedStudents((prev) => [...prev, student]);
    setSearchResults([]); // Collapse dropdown
    setSearchQuery("");
  }

  function removeStudent(studentId) {
    setSelectedStudents((prev) =>
      prev.filter((s) => s.student_id !== studentId)
    );
    setBulkGcashRefs((prev) => {
      const copy = { ...prev };
      delete copy[studentId];
      return copy;
    });
  }

  function handleAmountChange(e) {
    const value = e.target.value;
    setTransactionAmount(value);
    const num = parseFloat(value);
    const maxAmount = hasPartialStudent
      ? partialRemainingAmount
      : contributionAmount;
    if (num > maxAmount) {
      setAmountError(`Amount cannot exceed ${formatCurrency(maxAmount)}`);
    } else if (num <= 0) {
      setAmountError("Amount must be greater than 0");
    } else {
      setAmountError("");
    }
  }

  function handleFullPayment() {
    const maxAmount = hasPartialStudent
      ? partialRemainingAmount
      : contributionAmount;
    setTransactionAmount(maxAmount.toString());
    setAmountError("");
  }

  function handleBulkGcashChange(studentId, value) {
    setBulkGcashRefs((prev) => ({ ...prev, [studentId]: value }));
  }

  function validateBulkGcash() {
    if (paymentMethod !== "gcash") return true;
    if (selectedStudents.length <= 1) return !!gcashRefId;
    return selectedStudents.every((s) => bulkGcashRefs[s.student_id]?.trim());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (
      selectedStudents.length === 0 ||
      !transactionAmount ||
      amountError ||
      !validateBulkGcash()
    )
      return;

    try {
      setSubmitting(true);
      const paymentMethodId = getPaymentMethodId(paymentMethod);
      const isBulkGcash =
        paymentMethod === "gcash" && selectedStudents.length > 1;
      const transactions = selectedStudents.map((student) => ({
        student_id: student.student_id,
        semester_id: selectedSemesterId,
        amount: parseFloat(transactionAmount),
        payment_method_id: paymentMethodId,
        gcash_ref_id: isBulkGcash
          ? bulkGcashRefs[student.student_id] || null
          : paymentMethod === "gcash"
          ? gcashRefId
          : null,
        verification_status: "pending",
        recorded_by: user.id,
      }));

      const { error } = await supabase
        .from("transactions")
        .insert(transactions);
      if (error) throw error;

      onSuccess?.();
      onClose();
    } catch (error) {
      alert("Error recording transaction: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const maxAmount = hasPartialStudent
    ? partialRemainingAmount
    : contributionAmount;
  const isBulkGcash = paymentMethod === "gcash" && selectedStudents.length > 1;

  // Search results with status badges (Matches SuperAdminDashboard style)
  const searchResultsList = useMemo(
    () =>
      searchResults.map((student) => {
        const canAdd = canAddStudent(student);
        const disabledReason = student.isFullyPaid
          ? "Fully Paid"
          : hasPartialStudent
          ? "Cannot mix with partial"
          : student.isPartial && selectedStudents.length > 0
          ? "Clear selection first"
          : null;

        return (
          <button
            key={student.student_id}
            type="button"
            onClick={() => canAdd && addStudent(student)}
            disabled={!canAdd}
            className={`w-full p-2 text-left transition-colors flex items-center gap-2 ${
              canAdd
                ? "hover:bg-slate-50 dark:hover:bg-slate-700"
                : "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xs">
              {student.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                {student.full_name}
              </p>
              <p className="text-xs text-slate-500">{student.student_id}</p>
            </div>
            {/* Status Badge */}
            {student.isFullyPaid ? (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Fully Paid
              </span>
            ) : student.isPartial ? (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                Partial: {formatCurrency(student.totalPaid)}
              </span>
            ) : (
              <Plus className="w-4 h-4 text-primary-500" />
            )}
          </button>
        );
      }),
    [searchResults, hasPartialStudent, selectedStudents.length]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {semesterName && (
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recording for
            </p>
            <p className="font-bold text-primary-700 dark:text-primary-300">
              {semesterName}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Status will be set to "Pending" until verified
            </p>
          </div>
        )}

        {hasPartialStudent && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Partial Payment Student Selected
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-300">
                Max amount: {formatCurrency(partialRemainingAmount)} (remaining
                balance)
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select Students
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              {searchResultsList}
            </div>
          )}

          {selectedStudents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedStudents.map((student) => (
                <span
                  key={student.student_id}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                    student.isPartial
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  }`}
                >
                  {student.full_name}
                  {student.isPartial && (
                    <span className="text-xs opacity-75">
                      (owes{" "}
                      {formatCurrency(contributionAmount - student.totalPaid)})
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeStudent(student.student_id)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {selectedStudents.length} student(s) selected
            {hasPartialStudent && " • Single student mode (partial payment)"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Payment Method
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={paymentMethod === "cash"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-4 h-4 text-primary-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Cash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="gcash"
                checked={paymentMethod === "gcash"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-4 h-4 text-primary-500"
              />
              <span className="text-slate-700 dark:text-slate-300">GCash</span>
            </label>
          </div>
        </div>

        {paymentMethod === "gcash" && (
          <div>
            {isBulkGcash ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  GCash Reference Numbers{" "}
                  <span className="text-red-500">*</span>
                </label>
                {selectedStudents.map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400 w-32 truncate">
                      {student.full_name}:
                    </span>
                    <input
                      type="text"
                      placeholder="Reference #"
                      value={bulkGcashRefs[student.student_id] || ""}
                      onChange={(e) =>
                        handleBulkGcashChange(
                          student.student_id,
                          e.target.value
                        )
                      }
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  GCash Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter GCash reference number"
                  value={gcashRefId}
                  onChange={(e) => setGcashRefId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Amount (₱)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxAmount}
              placeholder="Enter amount"
              value={transactionAmount}
              onChange={handleAmountChange}
              className={`flex-1 px-4 py-2 rounded-xl border ${
                amountError
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 dark:border-slate-600 focus:ring-primary-500"
              } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2`}
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleFullPayment}
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <Zap className="w-4 h-4" />
              {hasPartialStudent ? "Balance" : "Full"}
            </Button>
          </div>
          {amountError && (
            <p className="text-xs text-red-500 mt-1">{amountError}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Max: {formatCurrency(maxAmount)}
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={
            selectedStudents.length === 0 ||
            !transactionAmount ||
            !!amountError ||
            submitting ||
            (paymentMethod === "gcash" && !validateBulkGcash())
          }
        >
          {submitting
            ? "Recording..."
            : `Record ${selectedStudents.length} Transaction(s)`}
        </Button>
      </form>
    </Modal>
  );
});

// =============================================================================
// MAIN COMPONENT: AdminDashboard
// =============================================================================
export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Dashboard State
  const [loading, setLoading] = useState(true);
  const [activeSemester, setActiveSemester] = useState(null);
  const [students, setStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [timeFilter, setTimeFilter] = useState("weekly");
  const [totalEnrolledCount, setTotalEnrolledCount] = useState(0);

  // Modal visibility
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  useEffect(() => {
    fetchActiveSemester();
  }, []);

  useEffect(() => {
    if (activeSemester?.id) {
      fetchDashboardData();
    }
  }, [activeSemester?.id]);

  // Real-time subscription with granular updates (hybrid approach)
  useEffect(() => {
    if (!activeSemester?.id) return;

    const channel = supabase
      .channel("admin-dashboard-realtime")
      // Transactions - granular INSERT/UPDATE, full refresh for DELETE
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new;
          if (String(newTx.semester_id) === String(activeSemester.id)) {
            setTransactions((prev) => [...prev, newTx]);
            fetchRecentActivity();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const updatedTx = payload.new;
          if (String(updatedTx.semester_id) === String(activeSemester.id)) {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === updatedTx.id ? { ...t, ...updatedTx } : t
              )
            );
            fetchRecentActivity();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "transactions" },
        () => {
          // Full refresh for DELETE to ensure accuracy
          fetchDashboardData();
        }
      )
      // Semester enrollments - INSERT fetches new student, DELETE does full refresh
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "semester_enrollments" },
        (payload) => {
          if (String(payload.new.semester_id) === String(activeSemester.id)) {
            fetchNewEnrollment(payload.new.student_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "semester_enrollments" },
        () => {
          // Full refresh for DELETE to ensure accuracy
          fetchDashboardData();
        }
      )
      // Students - granular UPDATE, DELETE does full refresh
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "students" },
        (payload) => {
          const updatedStudent = payload.new;
          setStudents((prev) =>
            prev.map((s) =>
              s.student_id === updatedStudent.student_id
                ? { ...s, students: { ...s.students, ...updatedStudent } }
                : s
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "students" },
        () => {
          // Full refresh for DELETE
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSemester?.id]);

  // Helper: Fetch recent activity only
  async function fetchRecentActivity() {
    if (!activeSemester?.id) return;
    try {
      const { data: recent } = await supabase
        .from("transactions")
        .select(
          `
          id,
          amount,
          verification_status,
          created_at,
          students (full_name, student_id),
          profiles!recorded_by (username)
        `
        )
        .eq("semester_id", activeSemester.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setRecentActivity(recent || []);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  }

  // Helper: Fetch new enrollment data
  async function fetchNewEnrollment(studentId) {
    if (!activeSemester?.id) return;
    try {
      const { data } = await supabase
        .from("semester_enrollments")
        .select(
          "student_id, enrolled_at, students (student_id, full_name, college_id)"
        )
        .eq("semester_id", activeSemester.id)
        .eq("student_id", studentId)
        .single();

      if (data) {
        setStudents((prev) => [...prev, data]);
        setTotalEnrolledCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error fetching new enrollment:", error);
    }
  }

  async function fetchActiveSemester() {
    try {
      const { data, error } = await supabase
        .from("semesters")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setActiveSemester(data);
        setContributionAmount(parseFloat(data.contribution_amount) || 0);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching active semester:", error);
      setLoading(false);
    }
  }

  async function fetchDashboardData() {
    if (!activeSemester?.id) return;

    try {
      setLoading(true);

      const enrolledStudents = await fetchAllRows(
        "semester_enrollments",
        "student_id, enrolled_at, students (student_id, full_name, college_id)",
        { semester_id: activeSemester.id }
      );

      setStudents(enrolledStudents);
      setTotalEnrolledCount(enrolledStudents.length);

      const semesterTransactions = await fetchAllRows(
        "transactions",
        "id, student_id, amount, verification_status, created_at",
        { semester_id: activeSemester.id }
      );

      setTransactions(semesterTransactions);

      const { data: recent } = await supabase
        .from("transactions")
        .select(
          `
          id,
          amount,
          verification_status,
          created_at,
          students (full_name, student_id),
          profiles!recorded_by (username)
        `
        )
        .eq("semester_id", activeSemester.id)
        .order("created_at", { ascending: false })
        .limit(8);

      setRecentActivity(recent || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalEnrolled = totalEnrolledCount || students.length;

    const studentPayments = {};
    transactions
      .filter((t) => t.verification_status === "verified")
      .forEach((t) => {
        if (!studentPayments[t.student_id]) {
          studentPayments[t.student_id] = 0;
        }
        studentPayments[t.student_id] += parseFloat(t.amount);
      });

    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let totalCollected = 0;

    students.forEach((enrollment) => {
      const paid = studentPayments[enrollment.student_id] || 0;
      totalCollected += paid;

      if (paid >= contributionAmount) {
        paidCount++;
      } else if (paid > 0) {
        partialCount++;
      } else {
        unpaidCount++;
      }
    });

    const expectedCollection = totalEnrolled * contributionAmount;
    const collectionProgress =
      expectedCollection > 0 ? (totalCollected / expectedCollection) * 100 : 0;

    return {
      totalEnrolled,
      totalCollected,
      expectedCollection,
      collectionProgress,
      paidCount,
      partialCount,
      unpaidCount,
    };
  }, [students, transactions, contributionAmount, totalEnrolledCount]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: "Paid", value: metrics.paidCount, color: COLORS.paid },
      { name: "Partial", value: metrics.partialCount, color: COLORS.partial },
      { name: "Unpaid", value: metrics.unpaidCount, color: COLORS.unpaid },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Bar chart data
  const barData = useMemo(() => {
    const verifiedTx = transactions.filter(
      (t) => t.verification_status === "verified"
    );

    if (verifiedTx.length === 0) return [];

    const grouped = {};

    verifiedTx.forEach((t) => {
      const date = new Date(t.created_at);
      let key;

      if (timeFilter === "daily") {
        key = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      } else if (timeFilter === "weekly") {
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil(
          ((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
        );
        key = `Week ${weekNum}`;
      } else {
        key = date.toLocaleDateString("en-US", { month: "short" });
      }

      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key]++;
    });

    return Object.entries(grouped)
      .map(([name, count]) => ({ name, count }))
      .slice(-10);
  }, [transactions, timeFilter]);

  function handleTransactionClick(transactionId) {
    navigate(`/transactions?highlight=${transactionId}`);
  }

  // No active semester
  if (!loading && !activeSemester) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Analytics for the active semester
          </p>
        </div>
        <Card className="p-8 text-center">
          <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            No Active Semester
          </h2>
          <p className="text-slate-500">
            Please wait for a Super Admin to set an active semester.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {activeSemester?.name || "Loading..."} - Analytics Overview
          </p>
        </div>
        <Button
          onClick={() => setShowTransactionModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Record Transaction
        </Button>
      </div>

      {/* Metrics Cards - Dynamic 4/5 columns */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          metrics.partialCount > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"
        } gap-6`}
      >
        <Card className="p-6 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Total Enrolled
              </p>
              <p
                className={`${getMetricTextSize(
                  metrics.totalEnrolled.toLocaleString()
                )} font-bold text-slate-900 dark:text-slate-100`}
              >
                {loading ? "..." : metrics.totalEnrolled.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-linear-to-r from-blue-500 to-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Total Collected
              </p>
              <p
                className={`${getMetricTextSize(
                  formatCurrency(metrics.totalCollected)
                )} font-bold text-green-600 dark:text-green-400`}
              >
                {loading ? "..." : formatCurrency(metrics.totalCollected)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-linear-to-r from-green-500 to-green-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Paid
              </p>
              <p
                className={`${getMetricTextSize(
                  metrics.paidCount.toLocaleString()
                )} font-bold text-green-600 dark:text-green-400`}
              >
                {loading ? "..." : metrics.paidCount.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-linear-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Partial Card - Only show if count > 0 */}
        {metrics.partialCount > 0 && (
          <Card className="p-6 glass bg-yellow-50/50 dark:bg-yellow-900/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Partial
                </p>
                <p
                  className={`${getMetricTextSize(
                    metrics.partialCount.toLocaleString()
                  )} font-bold text-yellow-600 dark:text-yellow-400`}
                >
                  {loading ? "..." : metrics.partialCount.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-linear-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 glass">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Unpaid
              </p>
              <p
                className={`${getMetricTextSize(
                  metrics.unpaidCount.toLocaleString()
                )} font-bold text-red-600 dark:text-red-400`}
              >
                {loading ? "..." : metrics.unpaidCount.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-linear-to-r from-red-500 to-pink-500 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Collection Progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Collection Progress
            </h2>
            <p className="text-sm text-slate-500">
              {formatCurrency(metrics.totalCollected)} of{" "}
              {formatCurrency(metrics.expectedCollection)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {loading ? "..." : `${metrics.collectionProgress.toFixed(1)}%`}
            </p>
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{
              width: `${Math.min(metrics.collectionProgress, 100)}%`,
            }}
          />
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Payment Status Distribution
          </h2>
          {loading ? (
            <div className="loading-shimmer h-64 rounded-lg" />
          ) : pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${value} students (${(
                      (value / metrics.totalEnrolled) *
                      100
                    ).toFixed(1)}%)`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Payment Frequency
            </h2>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              {["daily", "weekly", "monthly"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeFilter === filter
                      ? "bg-primary-500 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="loading-shimmer h-64 rounded-lg" />
          ) : barData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No transaction data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value) => [`${value} transactions`, "Count"]}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Recent Transactions
          </h2>
          <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full">
            Live Updates
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-shimmer h-16 rounded-lg" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((transaction) => (
              <div
                key={transaction.id}
                onClick={() => handleTransactionClick(transaction.id)}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                    {transaction.students?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {transaction.students?.full_name || "Unknown Student"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {transaction.students?.student_id} •{" "}
                      {formatDate(transaction.created_at)}
                      {transaction.profiles?.username && (
                        <span className="ml-2 text-xs text-primary-500">
                          by {transaction.profiles.username}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(transaction.amount)}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs ${
                      transaction.verification_status === "verified"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : transaction.verification_status === "pending"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        : transaction.verification_status === "flagged_for_edit"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {formatStatusText(transaction.verification_status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Transaction Modal */}
      <RecordTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        selectedSemesterId={activeSemester?.id}
        semesterName={activeSemester?.name}
        contributionAmount={contributionAmount}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}
