import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useRealtimeDashboard() {
  const [stats, setStats] = useState({
    totalCollections: 0,
    pendingVerifications: 0,
    unsettledAccounts: 0,
    recentActivity: [],
    loading: true,
  });

  useEffect(() => {
    fetchDashboardStats();

    // Subscribe to real-time changes
    const transactionsChannel = supabase
      .channel("dashboard-transactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        () => {
          fetchDashboardStats();
        }
      )
      .subscribe();

    const semestersChannel = supabase
      .channel("dashboard-semesters")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "semesters",
        },
        () => {
          fetchDashboardStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(semestersChannel);
    };
  }, []);

  async function fetchDashboardStats() {
    try {
      // Get active semester
      const { data: activeSemester } = await supabase
        .from("semesters")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!activeSemester) {
        setStats((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Get total collections for active semester
      const { data: verifiedTransactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("semester_id", activeSemester.id)
        .eq("verification_status", "verified");

      const totalCollections =
        verifiedTransactions?.reduce(
          (sum, t) => sum + parseFloat(t.amount),
          0
        ) || 0;

      // Get pending verifications count
      const { count: pendingCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("semester_id", activeSemester.id)
        .eq("verification_status", "pending");

      // Get recent activity (last 10 transactions)
      const { data: recentActivity } = await supabase
        .from("transactions")
        .select(
          `
          *,
          students (full_name, student_id),
          profiles!created_by (username)
        `
        )
        .eq("semester_id", activeSemester.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setStats({
        totalCollections,
        pendingVerifications: pendingCount || 0,
        unsettledAccounts: 0, // Will be calculated separately
        recentActivity: recentActivity || [],
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }

  return stats;
}
