import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { StudentSearch } from "../students/StudentSearch";
import { Clock, Undo2, CheckCircle, Zap, AlertCircle } from "lucide-react";
import { formatCurrency } from "../../lib/utils";

export function TransactionForm({ onSuccess }) {
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [semester, setSemester] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Partial payment tracking
  const [studentPaidAmount, setStudentPaidAmount] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [isPartialStudent, setIsPartialStudent] = useState(false);
  const [amountError, setAmountError] = useState("");

  // Fetch active semester and payment methods
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch student's existing payments when student is selected
  useEffect(() => {
    if (selectedStudent && semester) {
      fetchStudentPayments();
    } else {
      setStudentPaidAmount(0);
      setRemainingBalance(semester?.contribution_amount || 0);
      setIsPartialStudent(false);
    }
  }, [selectedStudent, semester]);

  // Update amount when remaining balance changes
  useEffect(() => {
    if (remainingBalance > 0) {
      setAmount(remainingBalance.toString());
    }
  }, [remainingBalance]);

  // Countdown timer for 30-second window
  useEffect(() => {
    if (!transaction) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - new Date(transaction.created_at).getTime();
      const remaining = 30000 - elapsed;

      if (remaining <= 0) {
        setTimeRemaining(0);
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [transaction]);

  async function fetchInitialData() {
    try {
      // Get active semester
      const { data: semData } = await supabase
        .from("semesters")
        .select("*")
        .eq("is_active", true)
        .single();

      if (semData) {
        setSemester(semData);
        setAmount(semData.contribution_amount);
        setRemainingBalance(parseFloat(semData.contribution_amount) || 0);
      }

      // Get payment methods
      const { data: pmData } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true);

      setPaymentMethods(pmData || []);
      if (pmData && pmData.length > 0) {
        setPaymentMethodId(pmData[0].id);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  }

  async function fetchStudentPayments() {
    try {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("student_id", selectedStudent.student_id)
        .eq("semester_id", semester.id)
        .eq("verification_status", "verified");

      const totalPaid = (transactions || []).reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      );

      const contribution = parseFloat(semester.contribution_amount) || 0;
      const remaining = Math.max(0, contribution - totalPaid);

      setStudentPaidAmount(totalPaid);
      setRemainingBalance(remaining);
      setIsPartialStudent(totalPaid > 0 && totalPaid < contribution);
      setAmount(remaining.toString());
    } catch (error) {
      console.error("Error fetching student payments:", error);
    }
  }

  function handleAmountChange(e) {
    const value = e.target.value;
    setAmount(value);

    const numValue = parseFloat(value) || 0;
    if (numValue > remainingBalance) {
      setAmountError(
        `Amount cannot exceed ${formatCurrency(remainingBalance)}`
      );
    } else if (numValue <= 0) {
      setAmountError("Amount must be greater than 0");
    } else {
      setAmountError("");
    }
  }

  function handleFullPayment() {
    setAmount(remainingBalance.toString());
    setAmountError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount) || 0;
    if (numAmount > remainingBalance) {
      setError(
        `Amount cannot exceed remaining balance of ${formatCurrency(
          remainingBalance
        )}`
      );
      return;
    }

    setLoading(true);

    try {
      // Find selected payment method
      const selectedMethod = paymentMethods.find(
        (pm) => pm.id === paymentMethodId
      );

      // Validate GCash reference
      if (selectedMethod?.name === "G-Cash" && !gcashRef.trim()) {
        throw new Error("GCash reference ID is required for GCash payments");
      }

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          student_id: selectedStudent.student_id,
          semester_id: semester.id,
          amount: parseFloat(amount),
          payment_method_id: paymentMethodId,
          gcash_ref_id: selectedMethod?.name === "G-Cash" ? gcashRef : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setTransaction(data);
      setTimeRemaining(30000);

      // Clear form
      setSelectedStudent(null);
      setGcashRef("");
      setAmount(semester.contribution_amount);
      setStudentPaidAmount(0);
      setRemainingBalance(parseFloat(semester.contribution_amount) || 0);
      setIsPartialStudent(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    if (!transaction) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);

      if (error) throw error;

      setTransaction(null);
      setTimeRemaining(null);
      if (onSuccess) onSuccess();
    } catch (error) {
      alert("Failed to undo transaction: " + error.message);
    }
  }

  const selectedMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
  const showGcashField = selectedMethod?.name === "G-Cash";
  const isFullyPaid = remainingBalance <= 0;

  return (
    <div className="space-y-6">
      {/* Success Banner with Timer */}
      {transaction && timeRemaining !== null && timeRemaining > 0 && (
        <Card className="p-6 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Transaction Created Successfully!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Amount: ₱{parseFloat(transaction.amount).toFixed(2)} for{" "}
                  {selectedStudent?.full_name || "student"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Clock className="w-5 h-5" />
                <span className="font-mono font-bold">
                  {Math.ceil(timeRemaining / 1000)}s
                </span>
              </div>
              <Button variant="danger" size="sm" onClick={handleUndo}>
                <Undo2 className="w-4 h-4 mr-2" />
                Undo
              </Button>
            </div>
          </div>
        </Card>
      )}

      {transaction && timeRemaining === 0 && (
        <Card className="p-6 bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <div>
              <h3 className="font-semibold text-primary-900 dark:text-primary-100">
                Transaction Locked
              </h3>
              <p className="text-sm text-primary-700 dark:text-primary-300">
                The 30-second edit window has expired. Transaction is now
                awaiting verification.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Transaction Form */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold gradient-text mb-6">
          New Transaction
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {!semester && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-700 dark:text-yellow-300 text-sm">
              No active semester found. Please contact administrator.
            </div>
          )}

          {/* Partial Payment Alert */}
          {isPartialStudent && selectedStudent && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Partial Payment Student
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300">
                  Already paid: {formatCurrency(studentPaidAmount)} • Remaining:{" "}
                  {formatCurrency(remainingBalance)}
                </p>
              </div>
            </div>
          )}

          {/* Fully Paid Alert */}
          {isFullyPaid && selectedStudent && (
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Student Fully Paid
                </p>
                <p className="text-xs text-green-600 dark:text-green-300">
                  This student has already paid the full contribution amount.
                </p>
              </div>
            </div>
          )}

          {/* Student Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Student
            </label>
            <StudentSearch
              onSelect={setSelectedStudent}
              selected={selectedStudent}
            />
          </div>

          {/* Amount with Full Button */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount (₱)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={handleAmountChange}
                required
                min="0"
                max={remainingBalance}
                step="0.01"
                disabled={isFullyPaid}
                className={`flex-1 px-4 py-2 rounded-xl border ${
                  amountError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                } bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 disabled:opacity-50`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFullPayment}
                disabled={isFullyPaid}
                className="flex items-center gap-1 whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                {isPartialStudent ? "Balance" : "Full"}
              </Button>
            </div>
            {amountError && (
              <p className="text-xs text-red-500 mt-1">{amountError}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Max: {formatCurrency(remainingBalance)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>

          {/* GCash Reference (conditional) */}
          {showGcashField && (
            <Input
              type="text"
              label="GCash Reference ID"
              placeholder="Enter GCash reference number"
              value={gcashRef}
              onChange={(e) => setGcashRef(e.target.value)}
              required
            />
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={
              !selectedStudent || !semester || isFullyPaid || !!amountError
            }
            className="w-full"
          >
            Create Transaction
          </Button>
        </form>
      </Card>
    </div>
  );
}
