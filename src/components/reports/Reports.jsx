import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatCurrency, formatDate } from "../../lib/utils";
import {
  exportData,
  exportCollectionSummary,
  formatExportCurrency,
} from "../../lib/exportUtils";
import {
  FileText,
  Download,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronUp,
  Wallet,
  FileSpreadsheet,
  FileType,
  File,
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
  cash: "#6366f1",
  gcash: "#06b6d4",
  other: "#8b5cf6",
};

// Export format options
const EXPORT_FORMATS = [
  {
    id: "xlsx",
    label: "Excel",
    icon: FileSpreadsheet,
    color: "text-green-600",
  },
  { id: "pdf", label: "PDF", icon: FileType, color: "text-red-600" },
  { id: "docx", label: "Word", icon: File, color: "text-blue-600" },
  { id: "csv", label: "CSV", icon: FileText, color: "text-slate-600" },
];

// Helper: Fetch all rows bypassing 1000 limit
async function fetchAllRows(tableName, selectQuery, filters = {}) {
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectQuery)
      .range(offset, offset + PAGE_SIZE - 1);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// Helper: Fetch all transactions with complex query
async function fetchAllTransactions(semesterId) {
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        *,
        students (full_name, student_id),
        payment_methods (name),
        verified_by_profile:profiles!verified_by (username)
      `
      )
      .eq("semester_id", semesterId)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export function Reports() {
  // State
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState(null);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [semesterName, setSemesterName] = useState("");

  // Data
  const [students, setStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [colleges, setColleges] = useState([]);

  // Filters for Unpaid Report
  const [unpaidFilters, setUnpaidFilters] = useState({
    college: "",
    department: "",
    yearLevel: "",
    major: "",
  });

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    unpaid: false,
    payments: false,
    methods: false,
  });

  // Export dropdown visibility
  const [exportDropdown, setExportDropdown] = useState(null);

  useEffect(() => {
    fetchSemesters();
    fetchColleges();
  }, []);

  useEffect(() => {
    if (selectedSemesterId) {
      fetchReportData();
    }
  }, [selectedSemesterId]);

  // Real-time subscription with granular updates
  useEffect(() => {
    if (!selectedSemesterId) return;

    const channel = supabase
      .channel("reports-realtime")
      // Transactions - handle verified status changes (without relying on payload.old)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new;
          // Only add if for current semester AND already verified
          if (
            String(newTx.semester_id) === String(selectedSemesterId) &&
            newTx.verification_status === "verified"
          ) {
            fetchSingleTransaction(newTx.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const tx = payload.new;
          if (String(tx.semester_id) !== String(selectedSemesterId)) return;

          if (tx.verification_status === "verified") {
            // Fetch with joins and add/update - called OUTSIDE setTransactions to avoid async race
            fetchSingleTransaction(tx.id);
          } else {
            // No longer verified - remove from state if it exists
            setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "transactions" },
        () => {
          // Full refresh for DELETE
          fetchReportData();
        }
      )
      // Semester enrollments
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "semester_enrollments" },
        (payload) => {
          if (String(payload.new.semester_id) === String(selectedSemesterId)) {
            fetchNewEnrollment(payload.new.student_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "semester_enrollments" },
        () => {
          // Full refresh for DELETE
          fetchReportData();
        }
      )
      // Students - update in place
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "students" },
        (payload) => {
          const updated = payload.new;
          setStudents((prev) =>
            prev.map((enrollment) => {
              if (enrollment.student_id !== updated.student_id)
                return enrollment;
              return {
                ...enrollment,
                students: { ...enrollment.students, ...updated },
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "students" },
        () => {
          fetchReportData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSemesterId]);

  // Helper: Fetch single transaction with full data
  async function fetchSingleTransaction(txId) {
    try {
      const { data } = await supabase
        .from("transactions")
        .select(
          `
          *,
          students (full_name, student_id),
          payment_methods (name),
          verified_by_profile:profiles!verified_by (username)
        `
        )
        .eq("id", txId)
        .single();

      if (data) {
        setTransactions((prev) => {
          const exists = prev.some((t) => t.id === data.id);
          if (exists) {
            return prev.map((t) => (t.id === data.id ? data : t));
          }
          return [data, ...prev];
        });
      }
    } catch (error) {
      console.error("Error fetching single transaction:", error);
    }
  }

  // Helper: Fetch new enrollment data
  async function fetchNewEnrollment(studentId) {
    try {
      const { data } = await supabase
        .from("semester_enrollments")
        .select(
          `
          student_id,
          students (
            student_id,
            full_name,
            major,
            year_level,
            department,
            college_id,
            colleges (name, code)
          )
        `
        )
        .eq("semester_id", selectedSemesterId)
        .eq("student_id", studentId)
        .single();

      if (data) {
        setStudents((prev) => [...prev, data]);
      }
    } catch (error) {
      console.error("Error fetching new enrollment:", error);
    }
  }

  async function fetchSemesters() {
    const { data } = await supabase
      .from("semesters")
      .select("*")
      .order("start_date", { ascending: false });

    setSemesters(data || []);
    const active = data?.find((s) => s.is_active);
    if (active) {
      setSelectedSemesterId(active.id);
      setContributionAmount(parseFloat(active.contribution_amount) || 0);
      setSemesterName(active.name);
    } else if (data?.length > 0) {
      setSelectedSemesterId(data[0].id);
      setContributionAmount(parseFloat(data[0].contribution_amount) || 0);
      setSemesterName(data[0].name);
    }
  }

  async function fetchColleges() {
    const { data } = await supabase.from("colleges").select("*").order("name");
    setColleges(data || []);
  }

  async function fetchReportData() {
    try {
      setLoading(true);

      const semester = semesters.find((s) => s.id === selectedSemesterId);
      if (semester) {
        setContributionAmount(parseFloat(semester.contribution_amount) || 0);
        setSemesterName(semester.name);
      }

      // Fetch enrolled students (bypassing 1000 limit)
      const enrolledData = await fetchAllRows(
        "semester_enrollments",
        `
          student_id,
          students (
            student_id,
            full_name,
            major,
            year_level,
            department,
            college_id,
            colleges (name, code)
          )
        `,
        { semester_id: selectedSemesterId }
      );

      // Fetch verified transactions (bypassing 1000 limit)
      const txData = await fetchAllTransactions(selectedSemesterId);

      setStudents(enrolledData || []);
      setTransactions(txData || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalEnrolled = students.length;

    // Sum payments per student
    const studentPayments = {};
    transactions.forEach((t) => {
      if (!studentPayments[t.student_id]) studentPayments[t.student_id] = 0;
      studentPayments[t.student_id] += parseFloat(t.amount);
    });

    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let totalCollected = 0;

    const paidStudents = [];
    const partialStudents = [];
    const unpaidStudents = [];

    students.forEach((enrollment) => {
      const student = enrollment.students;
      if (!student) return;

      const paid = studentPayments[student.student_id] || 0;
      totalCollected += paid;

      const enrichedStudent = {
        ...student,
        totalPaid: paid,
        amountDue: contributionAmount - paid,
      };

      if (paid >= contributionAmount) {
        paidCount++;
        paidStudents.push(enrichedStudent);
      } else if (paid > 0) {
        partialCount++;
        partialStudents.push(enrichedStudent);
      } else {
        unpaidCount++;
        unpaidStudents.push(enrichedStudent);
      }
    });

    const expectedCollection = totalEnrolled * contributionAmount;
    const collectionRate =
      expectedCollection > 0 ? (totalCollected / expectedCollection) * 100 : 0;

    return {
      totalEnrolled,
      totalCollected,
      expectedCollection,
      collectionRate,
      paidCount,
      partialCount,
      unpaidCount,
      paidStudents,
      partialStudents,
      unpaidStudents,
    };
  }, [students, transactions, contributionAmount]);

  // Payment methods breakdown
  const methodsBreakdown = useMemo(() => {
    const breakdown = {};
    transactions.forEach((t) => {
      const method = t.payment_methods?.name || "Unknown";
      if (!breakdown[method]) {
        breakdown[method] = { count: 0, total: 0 };
      }
      breakdown[method].count++;
      breakdown[method].total += parseFloat(t.amount);
    });

    return Object.entries(breakdown).map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total,
      color:
        name.toLowerCase() === "cash"
          ? COLORS.cash
          : name.toLowerCase().includes("cash")
          ? COLORS.gcash
          : COLORS.other,
    }));
  }, [transactions]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: "Paid", value: metrics.paidCount, color: COLORS.paid },
      { name: "Partial", value: metrics.partialCount, color: COLORS.partial },
      { name: "Unpaid", value: metrics.unpaidCount, color: COLORS.unpaid },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    const allStudents = [...metrics.unpaidStudents, ...metrics.partialStudents];
    return {
      departments: [
        ...new Set(allStudents.map((s) => s.department).filter(Boolean)),
      ].sort(),
      yearLevels: [
        ...new Set(allStudents.map((s) => s.year_level).filter(Boolean)),
      ].sort(),
      majors: [
        ...new Set(allStudents.map((s) => s.major).filter(Boolean)),
      ].sort(),
    };
  }, [metrics]);

  // Filter unpaid/partial students
  const filteredUnpaidStudents = useMemo(() => {
    const allUnpaid = [...metrics.unpaidStudents, ...metrics.partialStudents];
    return allUnpaid.filter((s) => {
      if (unpaidFilters.college && s.college_id !== unpaidFilters.college)
        return false;
      if (unpaidFilters.department && s.department !== unpaidFilters.department)
        return false;
      if (unpaidFilters.yearLevel && s.year_level !== unpaidFilters.yearLevel)
        return false;
      if (unpaidFilters.major && s.major !== unpaidFilters.major) return false;
      return true;
    });
  }, [metrics, unpaidFilters]);

  function toggleSection(section) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function handleExport(reportType, format) {
    setExportDropdown(null);

    const timestamp = new Date().toISOString().split("T")[0];
    const options = {
      title: `${semesterName} - ${reportType}`,
      subtitle: `Generated on ${formatDate(new Date())}`,
    };

    switch (reportType) {
      case "Collection Summary":
        // Use the visual export for Collection Summary
        exportCollectionSummary(
          {
            totalEnrolled: metrics.totalEnrolled,
            totalCollected: metrics.totalCollected,
            expectedCollection: metrics.expectedCollection,
            collectionRate: metrics.collectionRate,
            paidCount: metrics.paidCount,
            partialCount: metrics.partialCount,
            unpaidCount: metrics.unpaidCount,
          },
          `collection_summary_${timestamp}`,
          format,
          {
            title: `Collection Summary Report`,
            subtitle: `Generated on ${formatDate(new Date())}`,
            semesterName: semesterName,
          }
        );
        break;

      case "Unpaid Students":
        exportData(
          filteredUnpaidStudents.map((s) => ({
            student_id: s.student_id,
            full_name: s.full_name,
            college: s.colleges?.name || "-",
            department: s.department || "-",
            year_level: s.year_level || "-",
            major: s.major || "-",
            total_paid: formatExportCurrency(s.totalPaid),
            amount_due: formatExportCurrency(s.amountDue),
          })),
          [
            { key: "student_id", label: "Student ID" },
            { key: "full_name", label: "Full Name" },
            { key: "college", label: "College" },
            { key: "department", label: "Department" },
            { key: "year_level", label: "Year" },
            { key: "major", label: "Major" },
            { key: "total_paid", label: "Paid" },
            { key: "amount_due", label: "Balance Due" },
          ],
          `unpaid_students_${timestamp}`,
          format,
          options
        );
        break;

      case "Payment List":
        exportData(
          transactions.map((t) => ({
            date: formatDate(t.created_at),
            student_id: t.students?.student_id || "-",
            student_name: t.students?.full_name || "-",
            amount: formatExportCurrency(t.amount),
            method: t.payment_methods?.name || "-",
            receipt: t.physical_receipt_id || "-",
            gcash_ref: t.gcash_ref_id || "-",
            verified_by: t.verified_by_profile?.username || "-",
          })),
          [
            { key: "date", label: "Date" },
            { key: "student_id", label: "Student ID" },
            { key: "student_name", label: "Student Name" },
            { key: "amount", label: "Amount" },
            { key: "method", label: "Method" },
            { key: "receipt", label: "Receipt #" },
            { key: "gcash_ref", label: "GCash Ref" },
            { key: "verified_by", label: "Verified By" },
          ],
          `payment_list_${timestamp}`,
          format,
          options
        );
        break;

      case "Payment Methods":
        exportData(
          methodsBreakdown.map((m) => ({
            method: m.name,
            count: m.count.toLocaleString(),
            total: formatExportCurrency(m.total),
            percentage:
              transactions.length > 0
                ? `${((m.count / transactions.length) * 100).toFixed(1)}%`
                : "0%",
          })),
          [
            { key: "method", label: "Payment Method" },
            { key: "count", label: "Transaction Count" },
            { key: "total", label: "Total Amount" },
            { key: "percentage", label: "% of Transactions" },
          ],
          `payment_methods_${timestamp}`,
          format,
          options
        );
        break;
    }
  }

  // Export dropdown component - also expands section when clicked
  function ExportDropdown({ reportType, sectionKey }) {
    const isOpen = exportDropdown === reportType;

    function handleButtonClick(e) {
      e.stopPropagation();
      // Expand the section if it's collapsed
      if (!expandedSections[sectionKey]) {
        setExpandedSections((prev) => ({ ...prev, [sectionKey]: true }));
      }
      setExportDropdown(isOpen ? null : reportType);
    }

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
          <ChevronDown
            className={`w-3 h-3 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setExportDropdown(null);
              }}
            />
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(reportType, fmt.id);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  <fmt.icon className={`w-4 h-4 ${fmt.color}`} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {fmt.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Reports</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Generate and export financial reports
          </p>
        </div>
        <select
          value={selectedSemesterId || ""}
          onChange={(e) => setSelectedSemesterId(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {semesters.map((sem) => (
            <option key={sem.id} value={sem.id}>
              {sem.name} {sem.is_active ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="loading-shimmer h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ================================================================ */}
          {/* SECTION 1: COLLECTION SUMMARY */}
          {/* ================================================================ */}
          <Card className="overflow-hidden">
            <div
              onClick={() => toggleSection("summary")}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Collection Summary
                  </h2>
                  <p className="text-sm text-slate-500">
                    Overview of payment collection status
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  reportType="Collection Summary"
                  sectionKey="summary"
                />
                {expandedSections.summary ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedSections.summary && (
              <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        Enrolled
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {metrics.totalEnrolled.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-4 bg-linear-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Collected
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(metrics.totalCollected)}
                    </p>
                  </div>

                  <div className="p-4 bg-linear-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                        Goal
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {formatCurrency(metrics.expectedCollection)}
                    </p>
                  </div>

                  <div className="p-4 bg-linear-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        Rate
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {metrics.collectionRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                      Payment Status Distribution
                    </h3>
                    {pieData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Status Cards */}
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            Fully Paid
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {metrics.paidCount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {metrics.totalEnrolled > 0
                          ? (
                              (metrics.paidCount / metrics.totalEnrolled) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>

                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-8 h-8 text-yellow-600" />
                        <div>
                          <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            Partial Payment
                          </p>
                          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                            {metrics.partialCount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-600 dark:text-yellow-400">
                        {metrics.totalEnrolled > 0
                          ? (
                              (metrics.partialCount / metrics.totalEnrolled) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>

                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-8 h-8 text-red-600" />
                        <div>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Unpaid
                          </p>
                          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {metrics.unpaidCount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-red-600 dark:text-red-400">
                        {metrics.totalEnrolled > 0
                          ? (
                              (metrics.unpaidCount / metrics.totalEnrolled) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ================================================================ */}
          {/* SECTION 2: UNPAID STUDENTS */}
          {/* ================================================================ */}
          <Card className="overflow-hidden">
            <div
              onClick={() => toggleSection("unpaid")}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-red-500 to-orange-600 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Unpaid Students Report
                  </h2>
                  <p className="text-sm text-slate-500">
                    {metrics.unpaidCount + metrics.partialCount} students with
                    outstanding balance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  reportType="Unpaid Students"
                  sectionKey="unpaid"
                />
                {expandedSections.unpaid ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedSections.unpaid && (
              <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                {/* Filters */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={unpaidFilters.college}
                    onChange={(e) =>
                      setUnpaidFilters({
                        ...unpaidFilters,
                        college: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Colleges</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>

                  <select
                    value={unpaidFilters.department}
                    onChange={(e) =>
                      setUnpaidFilters({
                        ...unpaidFilters,
                        department: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Departments</option>
                    {filterOptions.departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={unpaidFilters.yearLevel}
                    onChange={(e) =>
                      setUnpaidFilters({
                        ...unpaidFilters,
                        yearLevel: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Years</option>
                    {filterOptions.yearLevels.map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>

                  <select
                    value={unpaidFilters.major}
                    onChange={(e) =>
                      setUnpaidFilters({
                        ...unpaidFilters,
                        major: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Majors</option>
                    {filterOptions.majors.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          College
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Department
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Year
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Major
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-red-600 dark:text-red-400 uppercase">
                          Balance Due
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredUnpaidStudents.slice(0, 50).map((student) => (
                        <tr
                          key={student.student_id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {student.full_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {student.student_id}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {student.colleges?.code || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {student.department || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {student.year_level || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {student.major || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
                            {student.totalPaid > 0
                              ? formatCurrency(student.totalPaid)
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {formatCurrency(student.amountDue)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUnpaidStudents.length > 50 && (
                    <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-800">
                      Showing 50 of {filteredUnpaidStudents.length} students.
                      Export to view all.
                    </div>
                  )}
                  {filteredUnpaidStudents.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      No students match the selected filters
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* ================================================================ */}
          {/* SECTION 3: PAYMENT LIST */}
          {/* ================================================================ */}
          <Card className="overflow-hidden">
            <div
              onClick={() => toggleSection("payments")}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Payment List
                  </h2>
                  <p className="text-sm text-slate-500">
                    {transactions.length} verified transactions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  reportType="Payment List"
                  sectionKey="payments"
                />
                {expandedSections.payments ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedSections.payments && (
              <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">
                          Student
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Method
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Receipt #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase">
                          Verified By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {transactions.slice(0, 50).map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {tx.students?.full_name || "-"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tx.students?.student_id}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(tx.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {tx.payment_methods?.name || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono">
                            {tx.physical_receipt_id || tx.gcash_ref_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {tx.verified_by_profile?.username || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {transactions.length > 50 && (
                    <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-800">
                      Showing 50 of {transactions.length} transactions. Export
                      to view all.
                    </div>
                  )}
                  {transactions.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      No verified transactions found
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* ================================================================ */}
          {/* SECTION 4: PAYMENT METHODS ANALYSIS */}
          {/* ================================================================ */}
          <Card className="overflow-hidden">
            <div
              onClick={() => toggleSection("methods")}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Payment Methods Analysis
                  </h2>
                  <p className="text-sm text-slate-500">
                    Breakdown by payment method
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ExportDropdown
                  reportType="Payment Methods"
                  sectionKey="methods"
                />
                {expandedSections.methods ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedSections.methods && (
              <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                      Transaction Count by Method
                    </h3>
                    {methodsBreakdown.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={methodsBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              name === "count"
                                ? `${value} transactions`
                                : formatCurrency(value),
                              name === "count" ? "Count" : "Total",
                            ]}
                          />
                          <Bar
                            dataKey="count"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Stats Cards */}
                  <div className="space-y-4">
                    {methodsBreakdown.map((method) => (
                      <div
                        key={method.name}
                        className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: method.color }}
                          />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {method.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {method.count} transaction
                              {method.count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(method.total)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {transactions.length > 0
                              ? (
                                  (method.count / transactions.length) *
                                  100
                                ).toFixed(1)
                              : 0}
                            % of total
                          </p>
                        </div>
                      </div>
                    ))}
                    {methodsBreakdown.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                        No payment data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
