import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { StudentHistoryModal } from "./StudentHistoryModal";
import {
  User,
  Upload,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { formatCurrency, debounce } from "../../lib/utils";

export function StudentList() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const semesterIdFromUrl = searchParams.get("semesterId");

  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [colleges, setColleges] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [semesterName, setSemesterName] = useState("");
  const [isViewingActiveSemester, setIsViewingActiveSemester] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [currentSemesterId, setCurrentSemesterId] = useState(null);

  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const debouncedSearchRef = useRef(null);

  useEffect(() => {
    fetchColleges();
    fetchStudents();
  }, [semesterIdFromUrl]);

  // Real-time subscription with granular updates
  useEffect(() => {
    if (!currentSemesterId) return;

    const channel = supabase
      .channel("students-realtime")
      // Transactions - update student payment status when verified
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new;
          if (
            String(newTx.semester_id) === String(currentSemesterId) &&
            newTx.verification_status === "verified"
          ) {
            updateStudentPaymentStatus(
              newTx.student_id,
              parseFloat(newTx.amount)
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new;
          // Don't rely on payload.old - just refetch if it's for current semester
          if (String(newTx.semester_id) === String(currentSemesterId)) {
            refetchStudentPayment(newTx.student_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "transactions" },
        () => {
          // Full refresh for DELETE since payload.old may not have semester_id
          fetchStudents();
        }
      )
      // Semester enrollments - add/remove students
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "semester_enrollments" },
        (payload) => {
          if (String(payload.new.semester_id) === String(currentSemesterId)) {
            addNewStudent(payload.new.student_id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "semester_enrollments" },
        () => {
          // Full refresh for DELETE since payload.old may not have data
          fetchStudents();
        }
      )
      // Students - update student info in place
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "students" },
        (payload) => {
          const updated = payload.new;
          setStudents((prev) =>
            prev.map((s) =>
              s.student_id === updated.student_id ? { ...s, ...updated } : s
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSemesterId, contributionAmount]);

  // Helper: Update student payment status when new verified transaction
  function updateStudentPaymentStatus(studentId, addedAmount) {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        const newTotal = (s.totalPaid || 0) + addedAmount;
        return {
          ...s,
          totalPaid: newTotal,
          isPaid: newTotal >= contributionAmount,
          isPartial: newTotal > 0 && newTotal < contributionAmount,
          isUnpaid: newTotal === 0,
        };
      })
    );
  }

  // Helper: Refetch single student's payment status
  async function refetchStudentPayment(studentId) {
    if (!currentSemesterId) return;
    try {
      const { data: txData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("student_id", studentId)
        .eq("semester_id", currentSemesterId)
        .eq("verification_status", "verified");

      const totalPaid = (txData || []).reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      );

      setStudents((prev) =>
        prev.map((s) => {
          if (s.student_id !== studentId) return s;
          return {
            ...s,
            totalPaid,
            isPaid: totalPaid >= contributionAmount,
            isPartial: totalPaid > 0 && totalPaid < contributionAmount,
            isUnpaid: totalPaid === 0,
          };
        })
      );
    } catch (error) {
      console.error("Error refetching student payment:", error);
    }
  }

  // Helper: Add new enrolled student
  async function addNewStudent(studentId) {
    if (!currentSemesterId) return;
    try {
      const { data: student } = await supabase
        .from("students")
        .select("*, colleges (id, name, code)")
        .eq("student_id", studentId)
        .single();

      if (student) {
        setStudents((prev) => [
          ...prev,
          {
            ...student,
            semester_enrollments: [{ semester_id: currentSemesterId }],
            totalPaid: 0,
            isPaid: false,
            isPartial: false,
            isUnpaid: true,
          },
        ]);
        setTotalCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error adding new student:", error);
    }
  }

  async function fetchColleges() {
    const { data } = await supabase.from("colleges").select("*").order("name");
    setColleges(data || []);
  }

  // Server-side search function
  async function searchStudentsFromDB(query) {
    if (!currentSemesterId) return;

    try {
      setSearching(true);

      // Build query with ilike for server-side search
      let dbQuery = supabase
        .from("students")
        .select(
          `
          *,
          colleges (id, name, code),
          semester_enrollments!inner (
            semester_id,
            enrolled_at
          )
        `,
          { count: "exact" }
        )
        .eq("semester_enrollments.semester_id", currentSemesterId);

      // Add search filter if query exists
      if (query && query.trim()) {
        const searchTerm = query.trim();
        dbQuery = dbQuery.or(
          `full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`
        );
      }

      // Add other filters
      if (selectedCollege) {
        dbQuery = dbQuery.eq("college_id", selectedCollege);
      }
      if (selectedYear) {
        dbQuery = dbQuery.eq("year_level", selectedYear);
      }
      if (selectedMajor) {
        dbQuery = dbQuery.eq("major", selectedMajor);
      }

      dbQuery = dbQuery.order("full_name");

      const { data: studentData, error, count } = await dbQuery;

      if (error) throw error;

      // Fetch payment data for found students
      const studentIds = (studentData || []).map((s) => s.student_id);
      let transactionsMap = {};

      if (studentIds.length > 0) {
        const { data: txData } = await supabase
          .from("transactions")
          .select("student_id, amount")
          .in("student_id", studentIds)
          .eq("semester_id", currentSemesterId)
          .eq("verification_status", "verified");

        (txData || []).forEach((tx) => {
          if (!transactionsMap[tx.student_id]) {
            transactionsMap[tx.student_id] = 0;
          }
          transactionsMap[tx.student_id] += parseFloat(tx.amount);
        });
      }

      // Enrich students with payment status
      const enrichedStudents = (studentData || []).map((student) => {
        const totalPaid = transactionsMap[student.student_id] || 0;
        return {
          ...student,
          totalPaid,
          isPaid: totalPaid >= contributionAmount,
          isPartial: totalPaid > 0 && totalPaid < contributionAmount,
          isUnpaid: totalPaid === 0,
        };
      });

      setStudents(enrichedStudents);
      setTotalCount(count || enrichedStudents.length);
    } catch (error) {
      console.error("Error searching students:", error);
    } finally {
      setSearching(false);
    }
  }

  async function fetchStudents() {
    try {
      setLoading(true);
      let targetSemesterId = semesterIdFromUrl;

      // Get semester info
      if (!targetSemesterId) {
        const { data: activeSem } = await supabase
          .from("semesters")
          .select("id, name, contribution_amount")
          .eq("is_active", true)
          .limit(1);

        if (activeSem && activeSem.length > 0) {
          targetSemesterId = activeSem[0].id;
          setSemesterName(activeSem[0].name);
          setContributionAmount(
            parseFloat(activeSem[0].contribution_amount) || 0
          );
          setIsViewingActiveSemester(true);
        }
      } else {
        const { data: sem } = await supabase
          .from("semesters")
          .select("name, is_active, contribution_amount")
          .eq("id", targetSemesterId)
          .limit(1);

        if (sem && sem.length > 0) {
          setSemesterName(sem[0].name);
          setContributionAmount(parseFloat(sem[0].contribution_amount) || 0);
          setIsViewingActiveSemester(sem[0].is_active);
        } else {
          setSemesterName("");
          setContributionAmount(0);
          setIsViewingActiveSemester(false);
        }
      }

      setCurrentSemesterId(targetSemesterId);

      if (!targetSemesterId) {
        setStudents([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Fetch students with enrollments
      const {
        data: studentData,
        error,
        count,
      } = await supabase
        .from("students")
        .select(
          `
          *,
          colleges (id, name, code),
          semester_enrollments!inner (
            semester_id,
            enrolled_at
          )
        `,
          { count: "exact" }
        )
        .eq("semester_enrollments.semester_id", targetSemesterId)
        .order("full_name");

      if (error) throw error;

      // Fetch all verified transactions for these students in one query
      const studentIds = (studentData || []).map((s) => s.student_id);

      let transactionsMap = {};

      if (studentIds.length > 0) {
        const { data: txData } = await supabase
          .from("transactions")
          .select("student_id, amount")
          .in("student_id", studentIds)
          .eq("semester_id", targetSemesterId)
          .eq("verification_status", "verified");

        // Aggregate payments by student
        (txData || []).forEach((tx) => {
          if (!transactionsMap[tx.student_id]) {
            transactionsMap[tx.student_id] = 0;
          }
          transactionsMap[tx.student_id] += parseFloat(tx.amount);
        });
      }

      // Enrich students with payment status
      const contribution = parseFloat(
        (
          await supabase
            .from("semesters")
            .select("contribution_amount")
            .eq("id", targetSemesterId)
            .single()
        ).data?.contribution_amount || 0
      );

      const enrichedStudents = (studentData || []).map((student) => {
        const totalPaid = transactionsMap[student.student_id] || 0;
        return {
          ...student,
          totalPaid,
          isPaid: totalPaid >= contribution,
          isPartial: totalPaid > 0 && totalPaid < contribution,
          isUnpaid: totalPaid === 0,
        };
      });

      setStudents(enrichedStudents);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  }

  // Get unique years and majors
  const years = useMemo(() => {
    const yrs = students
      .map((s) => s.year_level)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return yrs.sort();
  }, [students]);

  const majors = useMemo(() => {
    const maj = students
      .map((s) => s.major)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return maj.sort();
  }, [students]);

  // Filtered students - apply payment status filter (client-side since it's calculated)
  const filteredStudents = useMemo(() => {
    if (!selectedPaymentStatus) return students;

    return students.filter((student) => {
      if (selectedPaymentStatus === "paid") return student.isPaid;
      if (selectedPaymentStatus === "partial") return student.isPartial;
      if (selectedPaymentStatus === "unpaid") return student.isUnpaid;
      return true;
    });
  }, [students, selectedPaymentStatus]);

  // Debounced server-side search effect
  useEffect(() => {
    // Create debounced search function
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }

    // Only trigger server-side search if we have a semester
    if (!currentSemesterId) return;

    // If there's a search query or filter, use server-side search
    if (searchQuery || selectedCollege || selectedYear || selectedMajor) {
      debouncedSearchRef.current = setTimeout(() => {
        searchStudentsFromDB(searchQuery);
      }, 300);
    } else {
      // No filters - load all students
      fetchStudents();
    }

    // Reset visible count
    setVisibleCount(20);

    return () => {
      if (debouncedSearchRef.current) {
        clearTimeout(debouncedSearchRef.current);
      }
    };
  }, [
    searchQuery,
    selectedCollege,
    selectedYear,
    selectedMajor,
    currentSemesterId,
  ]);

  const visibleStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleCount);
  }, [filteredStudents, visibleCount]);

  const loadMore = useCallback(() => {
    if (visibleCount < filteredStudents.length) {
      setVisibleCount((prev) => Math.min(prev + 20, filteredStudents.length));
    }
  }, [visibleCount, filteredStudents.length]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
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
  }, [loadMore]);

  function openStudentHistory(student) {
    setSelectedStudent(student);
    setShowHistory(true);
  }

  function returnToActiveSemester() {
    navigate("/students");
  }

  function getPaymentStatusBadge(student) {
    if (student.isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      );
    } else if (student.isPartial) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <Clock className="w-3 h-3" />
          {formatCurrency(student.totalPaid)}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Unpaid
        </span>
      );
    }
  }

  const hasActiveFilters =
    searchQuery ||
    selectedCollege ||
    selectedPaymentStatus ||
    selectedYear ||
    selectedMajor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Students</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {semesterName && `${semesterName} • `}
            {visibleStudents.length} of{" "}
            {hasActiveFilters ? filteredStudents.length : totalCount} students
          </p>
        </div>
        <div className="flex gap-2">
          {semesterIdFromUrl && !isViewingActiveSemester && (
            <Button
              variant="outline"
              onClick={returnToActiveSemester}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Active Semester
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              onClick={() => navigate("/students/import")}
              className="flex items-center justify-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Students
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={selectedCollege}
            onChange={(e) => setSelectedCollege(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Colleges</option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.code}
              </option>
            ))}
          </select>

          <select
            value={selectedMajor}
            onChange={(e) => setSelectedMajor(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Majors</option>
            {majors.map((major) => (
              <option key={major} value={major}>
                {major}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="paid">✓ Paid</option>
            <option value="partial">◐ Partial</option>
            <option value="unpaid">✗ Unpaid</option>
          </select>
        </div>
      </Card>

      {/* Student Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="loading-shimmer h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleStudents.map((student) => (
              <div
                key={student.student_id}
                onClick={() => openStudentHistory(student)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {student.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {student.full_name}
                      </h3>
                      {/* Payment Status Badge */}
                      {getPaymentStatusBadge(student)}
                    </div>
                    {student.major && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded">
                        {student.major}
                      </span>
                    )}
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {student.student_id}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {student.colleges?.name || "No College"}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {student.department}{" "}
                      {student.year_level && `• Year ${student.year_level}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Infinite Scroll Trigger */}
          {visibleCount < filteredStudents.length && (
            <div
              ref={loadMoreRef}
              className="flex items-center justify-center py-8"
            >
              <div className="loading-shimmer h-8 w-32 rounded-lg" />
            </div>
          )}
        </>
      )}

      {!loading && filteredStudents.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No students found</p>
            {searchQuery && (
              <p className="text-sm mt-2">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Student History Modal */}
      {selectedStudent && (
        <StudentHistoryModal
          isOpen={showHistory}
          onClose={() => {
            setShowHistory(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          currentSemesterId={currentSemesterId}
        />
      )}
    </div>
  );
}
