-- ============================================================
-- RPC FUNCTION: Get User Emails from auth.users
-- Run this in your Supabase SQL Editor
-- ============================================================

-- This function allows fetching emails from auth.users table
-- which is not directly accessible from the client side.
-- SECURITY DEFINER ensures it runs with elevated privileges.

CREATE OR REPLACE FUNCTION get_user_emails()
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    auth.users.id,
    auth.users.email::TEXT
  FROM auth.users;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_emails() TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ get_user_emails() function created successfully!';
    RAISE NOTICE '📋 This function fetches emails from auth.users table';
END $$;
