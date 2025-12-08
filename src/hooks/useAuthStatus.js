import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuthStatus() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to profile changes for real-time status/role detection
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new;
          setProfile(updatedProfile);
          // Note: We no longer auto-logout on suspension
          // The App.jsx will redirect to /suspended page instead
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);

      // Check and deactivate expired semesters (Super Admin only)
      if (data?.role === "super_admin") {
        try {
          await supabase.rpc("check_semester_expiry");
        } catch (error) {
          console.error("Error checking semester expiry:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    role: profile?.role,
    status: profile?.status,
    isSuperAdmin: profile?.role === "super_admin",
    isAdmin: profile?.role === "admin",
    isUser: profile?.role === "user",
    isActive: profile?.status === "active",
    isSuspended: profile?.status === "suspended",
    isFirstAdmin: profile?.is_first_admin === true,
    // Convenience: user needs verification if role is 'user'
    needsVerification: profile?.role === "user",
  };
}
