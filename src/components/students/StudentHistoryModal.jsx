import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import {
  Calendar,
  BookOpen,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "../../lib/utils";

export function StudentHistoryModal({
  isOpen,
  onClose,
  student,
  currentSemesterId,
}) {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && student) {
      fetchEnrollmentHistory();
    }
  }, [isOpen, student]);

  // Real-time subscription for transactions
  useEffect(() => {
    if (!isOpen || !student) return;

    const channel = supabase
      .channel(`student-history-${student.student_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          // Refetch if transaction is for this student
          if (
            payload.new?.student_id === student.student_id ||
            payload.old?.student_id === student.student_id
          ) {
            fetchEnrollmentHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, student]);

  async function fetchEnrollmentHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("semester_enrollments")
        .select(
          `
          *,
          semesters (id, name, start_date, end_date, contribution_amount),
          students!inner (
            student_id,
            full_name
          )
        `
        )
        .eq("student_id", student.student_id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      // Fetch payment status for each enrollment
      const enrichedData = await Promise.all(
        (data || []).map(async (enrollment) => {
          const { data: transactions } = await supabase
            .from("transactions")
            .select("id, amount, verification_status")
            .eq("student_id", student.student_id)
            .eq("semester_id", enrollment.semester_id);

          const totalPaid =
            transactions
              ?.filter((t) => t.verification_status === "verified")
              .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

          const expectedAmount = parseFloat(
            enrollment.semesters?.contribution_amount || 0
          );
          const isPaid = totalPaid >= expectedAmount;
          const isPartial = totalPaid > 0 && totalPaid < expectedAmount;

          return {
            ...enrollment,
            totalPaid,
            expectedAmount,
            isPaid,
            isPartial,
            transactionCount: transactions?.length || 0,
          };
        })
      );

      setEnrollments(enrichedData);
    } catch (error) {
      console.error("Error fetching enrollment history:", error);
    } finally {
      setLoading(false);
    }
  }

  function getPaymentStatusIcon(enrollment) {
    if (enrollment.isPaid) {
      return (
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
      );
    } else if (enrollment.isPartial) {
      return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    }
  }

  function getPaymentStatusText(enrollment) {
    if (enrollment.isPaid) return "Paid";
    if (enrollment.isPartial)
      return `Partial (${formatCurrency(enrollment.totalPaid)})`;
    return "Unpaid";
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US");
  }

  function handleViewTransactions(enrollment) {
    // Navigate to transactions with semester and student filters
    const params = new URLSearchParams({
      semesterId: enrollment.semester_id,
      search: student.student_id,
    });
    navigate(`/transactions?${params.toString()}`);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student Enrollment History">
      <div className="space-y-4">
        {/* Student Info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
            {student.full_name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {student.student_id}
          </p>
          {student.major && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {student.major} • Year {student.year_level}
            </p>
          )}
        </div>

        {/* Enrollment History */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-shimmer h-24 rounded-xl" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No enrollment history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        {enrollment.semesters?.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(
                            enrollment.semesters?.start_date
                          ).getFullYear()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{formatCurrency(enrollment.expectedAmount)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Date Added: {formatDate(enrollment.enrolled_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {getPaymentStatusIcon(enrollment)}
                      <span
                        className={`text-sm font-medium ${
                          enrollment.isPaid
                            ? "text-green-600 dark:text-green-400"
                            : enrollment.isPartial
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {getPaymentStatusText(enrollment)}
                      </span>
                    </div>
                    {enrollment.transactionCount > 0 && (
                      <button
                        onClick={() => handleViewTransactions(enrollment)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <span>
                          {enrollment.transactionCount} transaction
                          {enrollment.transactionCount !== 1 ? "s" : ""}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {enrollment.transactionCount === 0 && (
                      <span className="text-xs text-slate-400">
                        No transactions
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
