import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { formatCurrency, formatDate } from "../../lib/utils";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Flag,
  Copy,
  Check,
  ArrowUpDown,
  Hash,
  User,
  Calendar,
  FileText,
  Edit2,
  Zap,
  AlertCircle,
} from "lucide-react";

const PAGE_SIZE = 30;

// UUID regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
  return UUID_REGEX.test(str);
}

// Helper function to format status text properly
function formatStatusText(status) {
  if (!status) return "";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function TransactionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isSuperAdmin } = useAuth();

  // Data state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  // Single expanded row (string|null instead of Set)
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // Verification Modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingTransaction, setVerifyingTransaction] = useState(null);
  const [physicalReceiptId, setPhysicalReceiptId] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editForm, setEditForm] = useState({
    semester_id: "",
    amount: "",
    payment_method_id: "",
    gcash_ref_id: "",
    originalGcashRef: "", // Preserve original for restoration
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Edit modal partial payment tracking
  const [editStudentPaidAmount, setEditStudentPaidAmount] = useState(0);
  const [editRemainingBalance, setEditRemainingBalance] = useState(0);
  const [editIsPartialStudent, setEditIsPartialStudent] = useState(false);
  const [editAmountError, setEditAmountError] = useState("");

  // Rejection Modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingTransaction, setRejectingTransaction] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Refs
  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const highlightedRowRef = useRef(null);
  const initialHighlightHandled = useRef(false);

  // Fetch semesters and payment methods on mount
  useEffect(() => {
    fetchSemesters();
    fetchPaymentMethods();
  }, []);

  // Handle query params for filtering and highlighting
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    const semesterId = searchParams.get("semesterId");
    const searchValue = searchParams.get("search");

    // Set semester filter from URL (only on initial load)
    if (semesterId && !initialHighlightHandled.current) {
      setSelectedSemester(semesterId);
    }

    // Set search query from URL (only on initial load)
    if (searchValue && !initialHighlightHandled.current) {
      setSearchQuery(searchValue);
    }

    // Handle highlight - allow repeated highlights for different IDs
    if (highlightId && isValidUUID(highlightId)) {
      // Only process if it's a different ID than the last one we handled
      if (initialHighlightHandled.current !== highlightId) {
        initialHighlightHandled.current = highlightId;
        handleHighlightTransaction(highlightId);
      }
    }
  }, [searchParams]);

  async function handleHighlightTransaction(transactionId) {
    try {
      const { data: transaction, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          students (full_name, student_id),
          semesters (name),
          payment_methods (name),
          recorded_by_profile:profiles!recorded_by (username),
          verified_by_profile:profiles!verified_by (username)
        `
        )
        .eq("id", transactionId)
        .single();

      if (error || !transaction) {
        console.error("Could not find highlighted transaction:", error);
        setSearchParams({});
        return;
      }

      if (transaction.semester_id) {
        setSelectedSemester(transaction.semester_id);
      }

      setTimeout(() => {
        setExpandedRowId(transactionId);
        setTimeout(() => {
          if (highlightedRowRef.current) {
            highlightedRowRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 300);
      }, 500);
    } catch (err) {
      console.error("Error handling highlight:", err);
    }
  }

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch transactions when filters change
  useEffect(() => {
    setTransactions([]);
    setHasMore(true);
    fetchTransactions(true);
  }, [
    selectedSemester,
    selectedStatus,
    selectedPaymentMethod,
    debouncedSearch,
    sortBy,
  ]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (selectedSemester === "all") return;

    const channel = supabase
      .channel("transaction-history-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `semester_id=eq.${selectedSemester}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch the new transaction with relations
            const { data: newTx } = await supabase
              .from("transactions")
              .select(
                `
                *,
                students (full_name, student_id),
                semesters (name),
                payment_methods (name),
                recorded_by_profile:profiles!recorded_by (username),
                verified_by_profile:profiles!verified_by (username)
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (newTx) {
              setTransactions((prev) => [newTx, ...prev]);
              setTotalCount((prev) => prev + 1);
            }
          } else if (payload.eventType === "UPDATE") {
            // Fetch updated transaction with relations
            const { data: updatedTx } = await supabase
              .from("transactions")
              .select(
                `
                *,
                students (full_name, student_id),
                semesters (name),
                payment_methods (name),
                recorded_by_profile:profiles!recorded_by (username),
                verified_by_profile:profiles!verified_by (username)
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (updatedTx) {
              setTransactions((prev) =>
                prev.map((t) => (t.id === updatedTx.id ? updatedTx : t))
              );
            }
          } else if (payload.eventType === "DELETE") {
            setTransactions((prev) =>
              prev.filter((t) => t.id !== payload.old.id)
            );
            setTotalCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSemester]);

  async function fetchSemesters() {
    try {
      const { data } = await supabase
        .from("semesters")
        .select("id, name, is_active, contribution_amount")
        .order("start_date", { ascending: false });

      setSemesters(data || []);

      const highlightId = searchParams.get("highlight");
      const semesterId = searchParams.get("semesterId");
      if (!highlightId && !semesterId) {
        const active = data?.find((s) => s.is_active);
        if (active) {
          setSelectedSemester(active.id);
        }
      }
    } catch (error) {
      console.error("Error fetching semesters:", error);
    }
  }

  async function fetchPaymentMethods() {
    try {
      const { data } = await supabase
        .from("payment_methods")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  }

  async function fetchTransactions(reset = false) {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : transactions.length;

      let sortColumn = "created_at";
      let sortAscending = false;
      if (sortBy === "date_desc") {
        sortColumn = "created_at";
        sortAscending = false;
      } else if (sortBy === "date_asc") {
        sortColumn = "created_at";
        sortAscending = true;
      } else if (sortBy === "amount_desc") {
        sortColumn = "amount";
        sortAscending = false;
      } else if (sortBy === "amount_asc") {
        sortColumn = "amount";
        sortAscending = true;
      }

      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          students (full_name, student_id),
          semesters (name),
          payment_methods (name),
          recorded_by_profile:profiles!recorded_by (username),
          verified_by_profile:profiles!verified_by (username),
          edited_by_profile:profiles!edited_by (username),
          status_changed_by_profile:profiles!status_changed_by (username)
        `,
          { count: "exact" }
        )
        .order(sortColumn, { ascending: sortAscending })
        .range(offset, offset + PAGE_SIZE - 1);

      if (selectedSemester !== "all") {
        query = query.eq("semester_id", selectedSemester);
      }

      if (selectedStatus !== "all") {
        query = query.eq("verification_status", selectedStatus);
      }

      let searchByUUID = false;
      if (debouncedSearch.trim()) {
        if (isValidUUID(debouncedSearch.trim())) {
          query = query.eq("id", debouncedSearch.trim());
          searchByUUID = true;
        } else {
          query = query.or(
            `gcash_ref_id.ilike.%${debouncedSearch}%,physical_receipt_id.ilike.%${debouncedSearch}%`
          );
        }
      }

      const { data, error, count } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (reset && count !== null) {
        setTotalCount(count);
      }

      // Search by student name/ID
      if (debouncedSearch.trim() && !searchByUUID) {
        try {
          const { data: foundStudents } = await supabase
            .from("students")
            .select("student_id")
            .or(
              `full_name.ilike.%${debouncedSearch}%,student_id.ilike.%${debouncedSearch}%`
            )
            .limit(100);

          const foundStudentIds = foundStudents?.map((s) => s.student_id) || [];

          if (foundStudentIds.length > 0) {
            let studentQuery = supabase
              .from("transactions")
              .select(
                `
                *,
                students!inner (full_name, student_id),
                semesters (name),
                payment_methods (name),
                recorded_by_profile:profiles!recorded_by (username),
                verified_by_profile:profiles!verified_by (username),
                edited_by_profile:profiles!edited_by (username),
                status_changed_by_profile:profiles!status_changed_by (username)
              `
              )
              .in("student_id", foundStudentIds)
              .order(sortColumn, { ascending: sortAscending })
              .range(offset, offset + PAGE_SIZE - 1);

            if (selectedSemester !== "all") {
              studentQuery = studentQuery.eq("semester_id", selectedSemester);
            }
            if (selectedStatus !== "all") {
              studentQuery = studentQuery.eq(
                "verification_status",
                selectedStatus
              );
            }

            const { data: studentSearchData } = await studentQuery;

            const existingIds = new Set(filteredData.map((t) => t.id));
            (studentSearchData || []).forEach((t) => {
              if (!existingIds.has(t.id)) {
                filteredData.push(t);
              }
            });
          }

          filteredData.sort((a, b) => {
            const aVal =
              sortColumn === "amount"
                ? parseFloat(a.amount)
                : new Date(a.created_at);
            const bVal =
              sortColumn === "amount"
                ? parseFloat(b.amount)
                : new Date(b.created_at);
            return sortAscending ? aVal - bVal : bVal - aVal;
          });
        } catch (e) {
          console.error("Student search error:", e);
        }
      }

      if (selectedPaymentMethod !== "all") {
        filteredData = filteredData.filter((t) => {
          const method = t.payment_methods?.name?.toLowerCase() || "";
          return method.includes(selectedPaymentMethod.toLowerCase());
        });
      }

      if (reset) {
        setTransactions(filteredData);
      } else {
        setTransactions((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newItems = filteredData.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newItems];
        });
      }

      setHasMore(filteredData.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchTransactions(false);
    }
  }, [loadingMore, hasMore, transactions.length]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (currentRef) {
      observerRef.current.observe(currentRef);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, loading]);

  // Toggle row - single accordion behavior
  function toggleRow(id) {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  // Open verification modal - pre-fill if exists
  function openVerifyModal(transaction) {
    setVerifyingTransaction(transaction);
    // Pre-fill with existing physical_receipt_id if any
    setPhysicalReceiptId(transaction.physical_receipt_id || "");
    setShowVerifyModal(true);
  }

  async function handleVerifyTransaction(e) {
    e.preventDefault();

    if (!physicalReceiptId.trim()) {
      alert("Physical Receipt ID is required");
      return;
    }

    try {
      setVerifySubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("transactions")
        .update({
          verification_status: "verified",
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          physical_receipt_id: physicalReceiptId.trim(),
        })
        .eq("id", verifyingTransaction.id);

      if (error) throw error;

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === verifyingTransaction.id
            ? {
                ...t,
                verification_status: "verified",
                physical_receipt_id: physicalReceiptId.trim(),
              }
            : t
        )
      );

      setShowVerifyModal(false);
      setVerifyingTransaction(null);
      setPhysicalReceiptId("");
    } catch (error) {
      alert("Error verifying transaction: " + error.message);
    } finally {
      setVerifySubmitting(false);
    }
  }

  async function openEditModal(transaction) {
    setEditingTransaction(transaction);
    const gcashRef = transaction.gcash_ref_id || "";
    setEditForm({
      semester_id: transaction.semester_id || "",
      amount: transaction.amount || "",
      payment_method_id: transaction.payment_method_id || "",
      gcash_ref_id: gcashRef,
      originalGcashRef: gcashRef, // Store original for restoration
    });
    setEditAmountError("");

    // Fetch student's other verified payments for this semester (excluding current transaction)
    try {
      const { data: otherTransactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("student_id", transaction.student_id)
        .eq("semester_id", transaction.semester_id)
        .eq("verification_status", "verified")
        .neq("id", transaction.id);

      const otherPaid = (otherTransactions || []).reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      );

      const semester = semesters.find((s) => s.id === transaction.semester_id);
      const contribution = parseFloat(semester?.contribution_amount) || 0;
      const remaining = Math.max(0, contribution - otherPaid);

      setEditStudentPaidAmount(otherPaid);
      setEditRemainingBalance(remaining);
      setEditIsPartialStudent(otherPaid > 0);
    } catch (error) {
      console.error("Error fetching student payments:", error);
      // Fallback to semester max
      const semester = semesters.find((s) => s.id === transaction.semester_id);
      setEditRemainingBalance(parseFloat(semester?.contribution_amount) || 0);
      setEditStudentPaidAmount(0);
      setEditIsPartialStudent(false);
    }

    setShowEditModal(true);
  }

  function handleEditAmountChange(value) {
    setEditForm({ ...editForm, amount: value });

    const numValue = parseFloat(value) || 0;
    if (numValue > editRemainingBalance) {
      setEditAmountError(
        `Amount cannot exceed ${formatCurrency(editRemainingBalance)}`
      );
    } else if (numValue <= 0) {
      setEditAmountError("Amount must be greater than 0");
    } else {
      setEditAmountError("");
    }
  }

  function handleEditFullPayment() {
    setEditForm({ ...editForm, amount: editRemainingBalance.toString() });
    setEditAmountError("");
  }

  function isGCashMethod(methodId) {
    const method = paymentMethods.find((m) => m.id === methodId);
    return (
      method?.name?.toLowerCase().includes("cash") &&
      method?.name?.toLowerCase().includes("g")
    );
  }

  async function handleEditTransaction(e) {
    e.preventDefault();

    if (
      !editForm.semester_id ||
      !editForm.amount ||
      !editForm.payment_method_id
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const selectedMethod = paymentMethods.find(
      (m) => m.id === editForm.payment_method_id
    );
    const isGCash = selectedMethod?.name?.toLowerCase() === "g-cash";

    // If GCash is selected, require gcash_ref_id
    if (isGCash && !editForm.gcash_ref_id.trim()) {
      alert("GCash Reference ID is required for GCash payments");
      return;
    }

    try {
      setEditSubmitting(true);

      // Determine if gcash_ref_id should be cleared
      const gcashRefValue = isGCash ? editForm.gcash_ref_id.trim() : null;

      const { error } = await supabase
        .from("transactions")
        .update({
          semester_id: editForm.semester_id,
          amount: parseFloat(editForm.amount),
          payment_method_id: editForm.payment_method_id,
          gcash_ref_id: gcashRefValue,
          verification_status: "pending",
          edited_by: user?.id,
          verified_at: null, // Clear verification on edit
          verified_by: null,
        })
        .eq("id", editingTransaction.id);

      if (error) throw error;

      // Find the new semester and payment method names for optimistic update
      const newSemester = semesters.find((s) => s.id === editForm.semester_id);
      const newPaymentMethod = paymentMethods.find(
        (m) => m.id === editForm.payment_method_id
      );

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTransaction.id
            ? {
                ...t,
                semester_id: editForm.semester_id,
                amount: parseFloat(editForm.amount),
                payment_method_id: editForm.payment_method_id,
                gcash_ref_id: gcashRefValue,
                verification_status: "pending",
                semesters: newSemester
                  ? { name: newSemester.name }
                  : t.semesters,
                payment_methods: newPaymentMethod
                  ? { name: newPaymentMethod.name }
                  : t.payment_methods,
                edited_by: user?.id,
                edited_by_profile: { username: profile?.username },
                verified_at: null,
                verified_by: null,
                verified_by_profile: null,
              }
            : t
        )
      );

      setShowEditModal(false);
      setEditingTransaction(null);
      setEditForm({
        semester_id: "",
        amount: "",
        payment_method_id: "",
        gcash_ref_id: "",
        originalGcashRef: "",
      });
    } catch (error) {
      alert("Error updating transaction: " + error.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function updateTransactionStatus(id, newStatus, adminNotes = null) {
    try {
      setUpdatingStatus(id);

      const updateData = {
        verification_status: newStatus,
        status_changed_by: user?.id,
        verified_at: null,
        verified_by: null,
      };

      if (adminNotes !== null) {
        updateData.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                verification_status: newStatus,
                status_changed_by: user?.id,
                status_changed_by_profile: { username: profile?.username },
                verified_at: null,
                verified_by: null,
                verified_by_profile: null,
                admin_notes: adminNotes || t.admin_notes,
              }
            : t
        )
      );
    } catch (error) {
      alert("Error updating status: " + error.message);
    } finally {
      setUpdatingStatus(null);
    }
  }

  function openRejectModal(transaction) {
    setRejectingTransaction(transaction);
    setRejectReason("");
    setShowRejectModal(true);
  }

  async function handleRejectTransaction(e) {
    e.preventDefault();
    if (!rejectingTransaction) return;

    try {
      setRejectSubmitting(true);
      await updateTransactionStatus(
        rejectingTransaction.id,
        "rejected",
        rejectReason.trim() || null
      );
      setShowRejectModal(false);
      setRejectingTransaction(null);
      setRejectReason("");
    } catch (error) {
      alert("Error rejecting transaction: " + error.message);
    } finally {
      setRejectSubmitting(false);
    }
  }

  // Clear highlight when clicking different transaction
  function handleRowClick(transactionId) {
    const highlightId = searchParams.get("highlight");
    if (highlightId && highlightId !== transactionId) {
      setSearchParams({});
    }
    setExpandedRowId(expandedRowId === transactionId ? null : transactionId);
  }

  function getStatusIcon(status) {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "flagged_for_edit":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
      case "flagged_for_edit":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
    }
  }

  function handleRefresh() {
    setTransactions([]);
    setHasMore(true);
    if (searchParams.get("highlight")) {
      setSearchParams({});
    }
    initialHighlightHandled.current = false;
    fetchTransactions(true);
  }

  const highlightId = searchParams.get("highlight");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Transaction History
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {totalCount > 0
              ? `${totalCount.toLocaleString()} total transactions`
              : "View all recorded transactions"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Filters & Sorting
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search student, ID, receipt, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Semesters</option>
            {semesters.map((sem) => (
              <option key={sem.id} value={sem.id}>
                {sem.name} {sem.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="flagged_for_edit">Flagged</option>
          </select>

          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Amount (High)</option>
              <option value="amount_asc">Amount (Low)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="loading-shimmer h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                <tr>
                  <th className="w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Payment Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.map((transaction) => (
                  <React.Fragment key={transaction.id}>
                    {/* Main Row */}
                    <tr
                      ref={
                        highlightId === transaction.id
                          ? highlightedRowRef
                          : null
                      }
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                        highlightId === transaction.id
                          ? "bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500"
                          : ""
                      }`}
                      onClick={() => handleRowClick(transaction.id)}
                    >
                      <td className="pl-4 py-3">
                        <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors">
                          {expandedRowId === transaction.id ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm">
                            {transaction.students?.full_name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {transaction.students?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {transaction.students?.student_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-100">
                            {transaction.semesters?.name || "N/A"}
                          </p>
                          <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {transaction.payment_methods?.name || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            transaction.verification_status
                          )}`}
                        >
                          {getStatusIcon(transaction.verification_status)}
                          <span>
                            {formatStatusText(transaction.verification_status)}
                          </span>
                        </span>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          {/* Role-based actions:
                              - Super Admin: All actions
                              - Admin: Only Edit on their own flagged transactions */}
                          {isSuperAdmin ? (
                            // Super Admin: Full actions
                            <>
                              <button
                                onClick={() => openEditModal(transaction)}
                                disabled={updatingStatus === transaction.id}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                                title="Edit Transaction"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {transaction.verification_status !==
                                "verified" && (
                                <button
                                  onClick={() => openVerifyModal(transaction)}
                                  disabled={updatingStatus === transaction.id}
                                  className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                                  title="Verify (Requires Receipt ID)"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {transaction.verification_status !==
                                "flagged_for_edit" && (
                                <button
                                  onClick={() =>
                                    updateTransactionStatus(
                                      transaction.id,
                                      "flagged_for_edit"
                                    )
                                  }
                                  disabled={updatingStatus === transaction.id}
                                  className="p-1.5 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors disabled:opacity-50"
                                  title="Flag for Edit"
                                >
                                  <Flag className="w-4 h-4" />
                                </button>
                              )}
                              {transaction.verification_status !==
                                "rejected" && (
                                <button
                                  onClick={() => openRejectModal(transaction)}
                                  disabled={updatingStatus === transaction.id}
                                  className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : // Admin: Edit if flagged OR within 2 minutes
                          transaction.recorded_by === user?.id &&
                            (transaction.verification_status ===
                              "flagged_for_edit" ||
                              new Date(transaction.created_at).getTime() >
                                Date.now() - 2 * 60 * 1000) ? (
                            <button
                              onClick={() => openEditModal(transaction)}
                              disabled={updatingStatus === transaction.id}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title={
                                transaction.verification_status ===
                                "flagged_for_edit"
                                  ? "Edit Flagged Transaction"
                                  : "Edit (Available for 2 mins)"
                              }
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedRowId === transaction.id && (
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-l-4 border-primary-500">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Technical IDs */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Hash className="w-4 h-4 text-primary-500" />
                                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                  Technical IDs
                                </span>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Transaction ID
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1.5 rounded font-mono break-all flex">
                                    {transaction.id}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(transaction.id)
                                    }
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors shrink-0"
                                    title="Copy ID"
                                  >
                                    {copiedId === transaction.id ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              {transaction.physical_receipt_id && (
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                    Physical Receipt ID
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1.5 rounded font-mono">
                                      {transaction.physical_receipt_id}
                                    </code>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(
                                          transaction.physical_receipt_id
                                        )
                                      }
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                                      title="Copy Receipt ID"
                                    >
                                      {copiedId ===
                                      transaction.physical_receipt_id ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Copy className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                              {transaction.gcash_ref_id && (
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                    GCash Reference
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1.5 rounded font-mono">
                                      {transaction.gcash_ref_id}
                                    </code>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(
                                          transaction.gcash_ref_id
                                        )
                                      }
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                                      title="Copy Reference"
                                    >
                                      {copiedId === transaction.gcash_ref_id ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Copy className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Audit Trail */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <User className="w-4 h-4 text-primary-500" />
                                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                  Audit Trail
                                </span>
                              </div>
                              <div className="flex gap-24">
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                      Recorded By
                                    </p>
                                    <p className="font-medium text-yellow-600 dark:text-yellow-400">
                                      {transaction.recorded_by_profile
                                        ?.username || "Unknown"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                      Verified By
                                    </p>
                                    {transaction.verified_by_profile
                                      ?.username ? (
                                      <div>
                                        <p className="font-medium text-green-600 dark:text-green-400">
                                          {
                                            transaction.verified_by_profile
                                              .username
                                          }
                                        </p>
                                        {transaction.verified_at && (
                                          <p className="text-xs text-slate-500">
                                            {formatDate(
                                              transaction.verified_at
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-slate-400 italic text-sm">
                                        Not verified yet
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {/* Edited By */}
                                  {transaction.edited_by_profile?.username && (
                                    <div>
                                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                        Last Edited By
                                      </p>
                                      <p className="font-medium text-blue-600 dark:text-blue-400">
                                        {transaction.edited_by_profile.username}
                                      </p>
                                    </div>
                                  )}
                                  {/* Status Changed By */}
                                  {transaction.status_changed_by_profile
                                    ?.username && (
                                    <div>
                                      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                        Status Changed By
                                      </p>
                                      <p className="font-medium text-purple-600 dark:text-purple-400">
                                        {
                                          transaction.status_changed_by_profile
                                            .username
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Timestamps */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-primary-500" />
                                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                  Timestamps
                                </span>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Created At
                                </p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {formatDate(transaction.created_at)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(
                                    transaction.created_at
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Updated At
                                </p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {formatDate(transaction.updated_at)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(
                                    transaction.updated_at
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {transactions.length === 0 && (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm mt-1">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}

            {transactions.length > 0 && (
              <div ref={loadMoreRef} className="p-4 flex justify-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading more...</span>
                  </div>
                ) : hasMore ? (
                  <span className="text-sm text-slate-500">
                    Scroll for more ({transactions.length} loaded)
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">
                    All {transactions.length} transactions loaded
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Verification Modal */}
      <Modal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verify Transaction"
      >
        <form onSubmit={handleVerifyTransaction} className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Physical Receipt Required
              </span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-300">
              Enter the physical receipt number to verify this transaction.
            </p>
          </div>

          {verifyingTransaction && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Student:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {verifyingTransaction.students?.full_name}
                </span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Amount:{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(verifyingTransaction.amount)}
                </span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Physical Receipt ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., RCP-2024-001234"
              value={physicalReceiptId}
              onChange={(e) => setPhysicalReceiptId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVerifyModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={verifySubmitting || !physicalReceiptId.trim()}
            >
              {verifySubmitting ? "Verifying..." : "Verify Transaction"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Transaction"
      >
        <form onSubmit={handleEditTransaction} className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-700 dark:text-blue-400">
                Edit Transaction Details
              </span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Editing will reset the status to "Pending" for re-verification.
            </p>
          </div>

          {editingTransaction && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Student:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {editingTransaction.students?.full_name}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                ID: {editingTransaction.students?.student_id}
              </p>
            </div>
          )}

          {/* Semester */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Semester <span className="text-red-500">*</span>
              {!isSuperAdmin && (
                <span className="text-xs text-slate-400 ml-2">(locked)</span>
              )}
            </label>
            <select
              value={editForm.semester_id}
              onChange={(e) =>
                setEditForm({ ...editForm, semester_id: e.target.value })
              }
              className={`w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isSuperAdmin ? "opacity-60 cursor-not-allowed" : ""
              }`}
              required
              disabled={!isSuperAdmin}
            >
              <option value="">Select Semester</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} {sem.is_active ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Partial Payment Alert */}
          {editIsPartialStudent && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Student Has Other Payments
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300">
                  Other verified: {formatCurrency(editStudentPaidAmount)} • Max
                  for this tx: {formatCurrency(editRemainingBalance)}
                </p>
              </div>
            </div>
          )}

          {/* Amount with Full Button */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={editRemainingBalance}
                  placeholder="0.00"
                  value={editForm.amount}
                  onChange={(e) => handleEditAmountChange(e.target.value)}
                  className={`w-full pl-8 pr-4 py-2 rounded-xl border ${
                    editAmountError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                  } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2`}
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleEditFullPayment}
                className="flex items-center gap-1 whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                {editIsPartialStudent ? "Balance" : "Full"}
              </Button>
            </div>
            {editAmountError && (
              <p className="text-xs text-red-500 mt-1">{editAmountError}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Max: {formatCurrency(editRemainingBalance)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={editForm.payment_method_id}
              onChange={(e) => {
                const newMethodId = e.target.value;
                const isNewMethodGCash =
                  paymentMethods
                    .find((m) => m.id === newMethodId)
                    ?.name?.toLowerCase() === "g-cash";

                setEditForm({
                  ...editForm,
                  payment_method_id: newMethodId,
                  // Restore original GCash ref when switching TO GCash, clear when switching away
                  gcash_ref_id: isNewMethodGCash
                    ? editForm.originalGcashRef
                    : "",
                });
              }}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Payment Method</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          {/* GCash Reference (conditional) */}
          {paymentMethods
            .find((m) => m.id === editForm.payment_method_id)
            ?.name?.toLowerCase() === "g-cash" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                GCash Reference ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 1234567890123"
                value={editForm.gcash_ref_id}
                onChange={(e) =>
                  setEditForm({ ...editForm, gcash_ref_id: e.target.value })
                }
                className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={
                editSubmitting ||
                !editForm.semester_id ||
                !editForm.amount ||
                !editForm.payment_method_id ||
                !!editAmountError ||
                // Disable if no changes made
                (editingTransaction &&
                  editForm.semester_id === editingTransaction.semester_id &&
                  parseFloat(editForm.amount) ===
                    parseFloat(editingTransaction.amount) &&
                  editForm.payment_method_id ===
                    editingTransaction.payment_method_id &&
                  editForm.gcash_ref_id ===
                    (editingTransaction.gcash_ref_id || ""))
              }
            >
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Transaction"
      >
        <form onSubmit={handleRejectTransaction} className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-700 dark:text-red-400">
                Confirm Rejection
              </span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-300">
              This will mark the transaction as rejected.
            </p>
          </div>

          {rejectingTransaction && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Student:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {rejectingTransaction.students?.full_name}
                </span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Amount:{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(rejectingTransaction.amount)}
                </span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rejection Reason{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={rejectSubmitting}
            >
              {rejectSubmitting ? "Rejecting..." : "Reject Transaction"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
