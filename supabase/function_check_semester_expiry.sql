-- ============================================================
-- FUNCTION: Check and Deactivate Expired Semesters
-- Auto-deactivates semesters that have passed their end date
-- ============================================================

CREATE OR REPLACE FUNCTION check_semester_expiry()
RETURNS void AS $$
BEGIN
  UPDATE semesters 
  SET is_active = false 
  WHERE end_date < CURRENT_DATE 
    AND is_active = true;
    
  RAISE NOTICE 'Expired semesters deactivated';
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Semester Expiry Check Function Created';
    RAISE NOTICE '📋 Call this function to deactivate expired semesters';
    RAISE NOTICE '💡 Recommended: Call from frontend on app mount or use pg_cron';
END $$;
