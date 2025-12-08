-- ============================================================
-- FIX: notify_transaction_status_change trigger
-- Updated to check user's notification_preferences before
-- creating a notification
-- ============================================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS transaction_status_notification ON transactions;

-- Update the function to check notification preferences
CREATE OR REPLACE FUNCTION notify_transaction_status_change()
RETURNS TRIGGER AS $$
DECLARE
    user_prefs JSONB;
BEGIN
    -- Only notify if status changed and not pending
    IF (TG_OP = 'UPDATE' AND OLD.verification_status != NEW.verification_status 
        AND NEW.verification_status != 'pending') THEN
        
        -- Get user's notification preferences
        SELECT notification_preferences INTO user_prefs 
        FROM profiles 
        WHERE id = NEW.recorded_by;
        
        -- Only insert notification if user wants transaction updates
        -- Default to true if preference is null or not set
        IF (user_prefs->>'transaction_updates')::boolean IS NOT FALSE THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                NEW.recorded_by,
                'transaction_' || NEW.verification_status::text,
                CASE 
                    WHEN NEW.verification_status = 'verified' THEN 
                        'Your transaction for ₱' || NEW.amount || ' has been verified.'
                    WHEN NEW.verification_status = 'rejected' THEN 
                        'Your transaction for ₱' || NEW.amount || ' has been rejected. Reason: ' || COALESCE(NEW.admin_notes, 'No reason provided')
                    WHEN NEW.verification_status = 'flagged_for_edit' THEN 
                        'Your transaction has been flagged for editing. You can now modify it.'
                END,
                NEW.id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER transaction_status_notification
    AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION notify_transaction_status_change();
