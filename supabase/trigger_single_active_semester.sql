-- ============================================================
-- MIGRATION: Single Active Semester Enforcement
-- Ensures only one semester can be active at a time
-- ============================================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION enforce_single_active_semester()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated row is being set to active
  IF NEW.is_active = true THEN
    -- Deactivate all other semesters
    UPDATE semesters 
    SET is_active = false 
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS single_active_semester_trigger ON semesters;
CREATE TRIGGER single_active_semester_trigger
  BEFORE UPDATE OR INSERT ON semesters
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_active_semester();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Single Active Semester Trigger Created';
    RAISE NOTICE '📋 Only one semester can be active at a time';
    RAISE NOTICE '🔄 When activating a semester, others are automatically deactivated';
END $$;
