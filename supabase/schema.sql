-- ============================================================
-- CCS CONTRIBUTION TRACKER - COMPLETE DATABASE SCHEMA
-- Single Source of Truth - Generated 2025-12-08
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE user_status AS ENUM ('active', 'suspended');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'flagged_for_edit');

-- ============================================================
-- 3. TABLES
-- ============================================================

-- Colleges
CREATE TABLE colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    suspension_reason TEXT,
    notification_preferences JSONB DEFAULT '{
        "transaction_updates": true,
        "new_user_registration": true,
        "role_changed_by_others": true,
        "self_suspension_actions": true,
        "transactions_from_others": true,
        "user_suspended_by_others": true,
        "user_unsuspended_by_others": true,
        "student_imports": true
    }'::jsonb,
    mascot_settings JSONB DEFAULT '{
        "enabled": true,
        "showWelcome": true,
        "mobileAutoOpen": true,
        "idleTimeout": 30,
        "autoMessageInterval": 120
    }'::jsonb,
    role_set_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    suspended_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    unsuspended_by UUID,
    is_first_admin BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students
CREATE TABLE students (
    student_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    college_id UUID REFERENCES colleges(id),
    department TEXT,
    year_level TEXT,
    major TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semesters
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contribution_amount NUMERIC NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semester Enrollments
CREATE TABLE semester_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT NOT NULL REFERENCES students(student_id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, semester_id)
);

-- Payment Methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT NOT NULL REFERENCES students(student_id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    amount NUMERIC NOT NULL,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    verification_status verification_status NOT NULL DEFAULT 'pending',
    physical_receipt_id TEXT UNIQUE,
    gcash_ref_id TEXT,
    admin_notes TEXT,
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    edited_by UUID REFERENCES profiles(id),
    status_changed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student Import Logs (parent record per import)
CREATE TABLE student_import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    imported_by UUID NOT NULL REFERENCES profiles(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    unchanged_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    is_reverted BOOLEAN NOT NULL DEFAULT false,
    reverted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student Import Entries (detail records per change)
CREATE TABLE student_import_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_log_id UUID NOT NULL REFERENCES student_import_logs(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('inserted', 'updated')),
    old_data JSONB,
    new_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_role_set_by ON profiles(role_set_by);
CREATE INDEX idx_profiles_suspended_by ON profiles(suspended_by);
CREATE INDEX idx_profiles_is_first_admin ON profiles(is_first_admin);

-- Students
CREATE INDEX idx_students_college ON students(college_id);
CREATE INDEX idx_students_name ON students(full_name);

-- Semester Enrollments
CREATE INDEX idx_semester_enrollments_student ON semester_enrollments(student_id);
CREATE INDEX idx_semester_enrollments_semester ON semester_enrollments(semester_id);

-- Semesters
CREATE INDEX idx_semesters_active ON semesters(is_active);

-- Transactions
CREATE INDEX idx_transactions_student ON transactions(student_id);
CREATE INDEX idx_transactions_semester ON transactions(semester_id);
CREATE INDEX idx_transactions_status ON transactions(verification_status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_created_by ON transactions(recorded_by);
CREATE INDEX idx_transactions_edited_by ON transactions(edited_by);
CREATE INDEX idx_transactions_status_changed_by ON transactions(status_changed_by);
CREATE INDEX idx_transactions_physical_receipt_id ON transactions(physical_receipt_id) WHERE physical_receipt_id IS NOT NULL;

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Student Import Logs
CREATE INDEX idx_student_import_logs_imported_by ON student_import_logs(imported_by);
CREATE INDEX idx_student_import_logs_semester ON student_import_logs(semester_id);
CREATE INDEX idx_student_import_logs_created_at ON student_import_logs(created_at);

-- Student Import Entries
CREATE INDEX idx_student_import_entries_log ON student_import_entries(import_log_id);
CREATE INDEX idx_student_import_entries_student ON student_import_entries(student_id);

-- ============================================================
-- 5. FUNCTIONS
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get current user role (for RLS)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

-- Get current user status (for RLS)
CREATE OR REPLACE FUNCTION get_current_user_status()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT status::TEXT FROM profiles WHERE id = auth.uid();
$$;

-- Get my role (for RLS)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    assigned_role user_role;
BEGIN
    SELECT role INTO assigned_role FROM public.profiles WHERE id = auth.uid();
    RETURN assigned_role;
END;
$$;

-- Get active semester
CREATE OR REPLACE FUNCTION get_active_semester()
RETURNS UUID
LANGUAGE plpgsql STABLE AS $$
DECLARE
    active_sem_id UUID;
BEGIN
    SELECT id INTO active_sem_id
    FROM semesters
    WHERE is_active = true
    AND CURRENT_DATE BETWEEN start_date AND end_date
    ORDER BY start_date DESC
    LIMIT 1;
    RETURN active_sem_id;
END;
$$;

-- Get user emails (for admin)
CREATE OR REPLACE FUNCTION get_user_emails()
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY 
    SELECT auth.users.id, auth.users.email::TEXT
    FROM auth.users;
END;
$$;

-- Check semester expiry
CREATE OR REPLACE FUNCTION check_semester_expiry()
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE semesters 
    SET is_active = false 
    WHERE end_date < CURRENT_DATE AND is_active = true;
END;
$$;

-- Enforce single active semester
CREATE OR REPLACE FUNCTION enforce_single_active_semester()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE semesters 
        SET is_active = false 
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$;

-- Validate GCash reference
CREATE OR REPLACE FUNCTION validate_gcash_reference()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    payment_method_name TEXT;
BEGIN
    SELECT name INTO payment_method_name 
    FROM payment_methods 
    WHERE id = NEW.payment_method_id;
    
    IF payment_method_name = 'G-Cash' AND (NEW.gcash_ref_id IS NULL OR NEW.gcash_ref_id = '') THEN
        RAISE EXCEPTION 'GCash reference ID is required for GCash payments';
    END IF;
    RETURN NEW;
END;
$$;

-- Handle new user (IMPORTANT: Sets role properly)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        'user'
    );
    RETURN NEW;
END;
$$;

-- Set first user as super admin AND first admin, everyone else as 'user'
CREATE OR REPLACE FUNCTION set_first_user_as_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    IF user_count = 0 THEN
        NEW.role = 'super_admin';
        NEW.is_first_admin = true;
    ELSE
        NEW.role = 'user';
    END IF;
    RETURN NEW;
END;
$$;

-- Get unsettled students
CREATE OR REPLACE FUNCTION get_unsettled_students(sem_id UUID)
RETURNS TABLE(student_id TEXT, full_name TEXT, college_name TEXT, department TEXT, year_level TEXT)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        s.student_id,
        s.full_name,
        c.name as college_name,
        s.department,
        s.year_level
    FROM students s
    INNER JOIN semester_enrollments se ON s.student_id = se.student_id
    LEFT JOIN colleges c ON s.college_id = c.id
    WHERE se.semester_id = sem_id
    AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.student_id = s.student_id
        AND t.semester_id = sem_id
        AND t.verification_status = 'verified'
    )
    ORDER BY c.name, s.department, s.year_level, s.full_name;
END;
$$;

-- ============================================================
-- 6. NOTIFICATION FUNCTIONS
-- ============================================================

-- Notify on new user registration
CREATE OR REPLACE FUNCTION notify_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    super_admin RECORD;
BEGIN
    FOR super_admin IN 
        SELECT id, notification_preferences 
        FROM profiles 
        WHERE role = 'super_admin' 
        AND status = 'active'
        AND id != NEW.id
    LOOP
        IF (super_admin.notification_preferences->>'new_user_registration')::boolean IS NOT FALSE THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                super_admin.id,
                'new_user_registration',
                'New user "' || COALESCE(NEW.username, 'Unknown') || '" has registered and needs a role assignment.',
                NEW.id
            );
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

-- Notify on user role change (with demotion cleanup and title case)
CREATE OR REPLACE FUNCTION notify_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    super_admin RECORD;
    role_set_by_username TEXT;
    formatted_role TEXT;
BEGIN
    IF OLD.role = NEW.role OR NEW.role_set_by IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- If demoted from super_admin, reset admin-only notification preferences
    IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
        NEW.notification_preferences = NEW.notification_preferences 
            - 'new_user_registration'
            - 'role_changed_by_others'
            - 'user_suspended_by_others'
            - 'user_unsuspended_by_others'
            - 'transactions_from_others';
    END IF;
    
    -- Format role for display (super_admin -> Super Admin)
    formatted_role := INITCAP(REPLACE(NEW.role::text, '_', ' '));
    
    SELECT username INTO role_set_by_username FROM profiles WHERE id = NEW.role_set_by;
    
    FOR super_admin IN 
        SELECT id, notification_preferences 
        FROM profiles 
        WHERE role = 'super_admin' 
        AND status = 'active'
        AND id != NEW.role_set_by
    LOOP
        IF (super_admin.notification_preferences->>'role_changed_by_others')::boolean IS NOT FALSE THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                super_admin.id,
                'role_changed_by_others',
                'User "' || COALESCE(NEW.username, 'Unknown') || '" role changed to ' || formatted_role || ' by ' || COALESCE(role_set_by_username, 'Unknown') || '.',
                NEW.id
            );
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;


-- Notify on user status change (suspend/unsuspend)
CREATE OR REPLACE FUNCTION notify_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    super_admin RECORD;
    action_type TEXT;
    action_by_username TEXT;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    IF NEW.status = 'suspended' THEN
        action_type := 'user_suspended_by_others';
        SELECT username INTO action_by_username FROM profiles WHERE id = NEW.suspended_by;
    ELSIF OLD.status = 'suspended' AND NEW.status = 'active' THEN
        action_type := 'user_unsuspended_by_others';
        SELECT username INTO action_by_username FROM profiles WHERE id = NEW.unsuspended_by;
    ELSE
        RETURN NEW;
    END IF;
    
    FOR super_admin IN 
        SELECT id, notification_preferences 
        FROM profiles 
        WHERE role = 'super_admin' 
        AND status = 'active'
        AND id != COALESCE(NEW.suspended_by, NEW.unsuspended_by)
    LOOP
        IF (super_admin.notification_preferences->>action_type)::boolean IS NOT FALSE THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                super_admin.id,
                action_type,
                CASE 
                    WHEN action_type = 'user_suspended_by_others' THEN
                        'User "' || COALESCE(NEW.username, 'Unknown') || '" was suspended by ' || COALESCE(action_by_username, 'Unknown') || '.'
                    ELSE
                        'User "' || COALESCE(NEW.username, 'Unknown') || '" was unsuspended by ' || COALESCE(action_by_username, 'Unknown') || '.'
                END,
                NEW.id
            );
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

-- Notify transaction status change (to recorder)
CREATE OR REPLACE FUNCTION notify_transaction_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    user_prefs JSONB;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.verification_status != NEW.verification_status 
        AND NEW.verification_status != 'pending') THEN
        
        SELECT notification_preferences INTO user_prefs 
        FROM profiles 
        WHERE id = NEW.recorded_by;
        
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
$$;

-- Notify transaction from others (to admins)
CREATE OR REPLACE FUNCTION notify_transaction_from_others()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    admin_user RECORD;
    student_name TEXT;
    actor_id UUID;
    actor_username TEXT;
    message_text TEXT;
    notification_type TEXT;
BEGIN
    SELECT full_name INTO student_name FROM students WHERE student_id = NEW.student_id;
    
    IF TG_OP = 'INSERT' THEN
        actor_id := NEW.recorded_by;
        notification_type := 'transaction_new';
        message_text := 'New transaction for ' || COALESCE(student_name, 'a student') || ' (₱' || NEW.amount || ') has been recorded.';
    ELSE
        IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
            -- Skip pending status notifications
            IF NEW.verification_status = 'pending' THEN
                RETURN NEW;
            END IF;
            
            actor_id := COALESCE(NEW.verified_by, NEW.status_changed_by, NEW.edited_by, NEW.recorded_by);
            
            CASE NEW.verification_status
                WHEN 'verified' THEN
                    notification_type := 'transaction_verified';
                    message_text := 'Transaction for ' || COALESCE(student_name, 'a student') || ' (₱' || NEW.amount || ') has been verified.';
                WHEN 'rejected' THEN
                    notification_type := 'transaction_rejected';
                    message_text := 'Transaction for ' || COALESCE(student_name, 'a student') || ' (₱' || NEW.amount || ') has been rejected. Reason: ' || COALESCE(NEW.admin_notes, 'No reason provided');
                WHEN 'flagged_for_edit' THEN
                    notification_type := 'transaction_flagged';
                    message_text := 'Transaction for ' || COALESCE(student_name, 'a student') || ' has been flagged for editing.';
                ELSE
                    notification_type := 'transaction_updated';
                    message_text := 'Transaction for ' || COALESCE(student_name, 'a student') || ' (₱' || NEW.amount || ') has been updated.';
            END CASE;
        ELSIF NEW.edited_by IS NOT NULL AND OLD.edited_by IS DISTINCT FROM NEW.edited_by THEN
            actor_id := NEW.edited_by;
            notification_type := 'transaction_edited';
            message_text := 'Transaction for ' || COALESCE(student_name, 'a student') || ' (₱' || NEW.amount || ') has been edited.';
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    
    SELECT username INTO actor_username FROM profiles WHERE id = actor_id;
    message_text := message_text || ' By ' || COALESCE(actor_username, 'an admin') || '.';
    
    FOR admin_user IN 
        SELECT id, notification_preferences 
        FROM profiles 
        WHERE role IN ('admin', 'super_admin')
        AND status = 'active'
        AND id != actor_id
    LOOP
        IF (admin_user.notification_preferences->>'transactions_from_others')::boolean IS NOT FALSE THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                admin_user.id,
                notification_type,
                message_text,
                NEW.id
            );
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

-- Notify transaction edit
CREATE OR REPLACE FUNCTION notify_transaction_edit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    editor_username TEXT;
    student_name TEXT;
    changes_text TEXT := '';
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.edited_by IS NOT NULL AND 
       (OLD.edited_by IS NULL OR OLD.edited_by != NEW.edited_by) THEN
        
        SELECT username INTO editor_username FROM profiles WHERE id = NEW.edited_by;
        SELECT full_name INTO student_name FROM students WHERE student_id = NEW.student_id;

        IF OLD.amount != NEW.amount THEN
            changes_text := changes_text || ' Amount: ₱' || OLD.amount || ' -> ₱' || NEW.amount;
        END IF;
        IF OLD.verification_status != NEW.verification_status THEN
            changes_text := changes_text || ' Status: ' || OLD.verification_status || ' -> ' || NEW.verification_status;
        END IF;
        IF OLD.payment_method_id != NEW.payment_method_id THEN
            changes_text := changes_text || ' Payment Method Changed';
        END IF;
        
        IF changes_text = '' THEN
            changes_text := ' Details updated';
        END IF;

        IF NEW.recorded_by != NEW.edited_by THEN
            INSERT INTO notifications (user_id, type, message, reference_id)
            VALUES (
                NEW.recorded_by,
                'transaction_edited',
                'Your transaction for ' || student_name || ' was edited by ' || COALESCE(editor_username, 'an admin') || '.' || changes_text,
                NEW.id
            );
        END IF;

        INSERT INTO notifications (user_id, type, message, reference_id)
        SELECT 
            p.id,
            'transaction_edited',
            'Transaction for ' || student_name || ' was edited by ' || COALESCE(editor_username, 'an admin') || '.' || changes_text,
            NEW.id
        FROM profiles p
        WHERE p.role = 'super_admin' 
        AND p.status = 'active'
        AND p.id != NEW.edited_by;
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Auth trigger (on auth.users)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Profile triggers
CREATE TRIGGER first_user_super_admin
    BEFORE INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_first_user_as_super_admin();

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_new_user_registration
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_new_user_registration();

CREATE TRIGGER on_user_role_change
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_user_role_change();

CREATE TRIGGER on_user_status_change
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_user_status_change();

-- College triggers
CREATE TRIGGER colleges_updated_at
    BEFORE UPDATE ON colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Student triggers
CREATE TRIGGER students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Semester triggers
CREATE TRIGGER semesters_updated_at
    BEFORE UPDATE ON semesters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER single_active_semester_trigger
    BEFORE INSERT OR UPDATE ON semesters
    FOR EACH ROW EXECUTE FUNCTION enforce_single_active_semester();

-- Transaction triggers
CREATE TRIGGER transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER validate_gcash_ref
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION validate_gcash_reference();

CREATE TRIGGER transaction_status_notification
    AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION notify_transaction_status_change();

CREATE TRIGGER on_transaction_from_others
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION notify_transaction_from_others();

CREATE TRIGGER transaction_edit_notification
    AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION notify_transaction_edit();

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Active admins can view all profiles" ON profiles
    FOR SELECT USING (
        get_current_user_role() IN ('admin', 'super_admin') 
        AND get_current_user_status() = 'active'
    );

CREATE POLICY "Super admins can view all profiles" ON profiles
    FOR SELECT USING (get_my_role() = 'super_admin');

CREATE POLICY "Super admins can update profiles" ON profiles
    FOR UPDATE USING (get_my_role() = 'super_admin');

-- Colleges Policies
CREATE POLICY "Anyone can view colleges" ON colleges
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage colleges" ON colleges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Students Policies
CREATE POLICY "Active users can view students" ON students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.status = 'active'
        )
    );

CREATE POLICY "Super admins can manage students" ON students
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin' 
            AND profiles.status = 'active'
        )
    );

-- Semesters Policies
CREATE POLICY "Active users can view semesters" ON semesters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.status = 'active'
        )
    );

CREATE POLICY "Super admins can manage semesters" ON semesters
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin' 
            AND profiles.status = 'active'
        )
    );

-- Semester Enrollments Policies
CREATE POLICY "Active users can view enrollments" ON semester_enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.status = 'active'
        )
    );

CREATE POLICY "Super admins can manage enrollments" ON semester_enrollments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin' 
            AND profiles.status = 'active'
        )
    );

-- Payment Methods Policies
CREATE POLICY "Anyone can view payment methods" ON payment_methods
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage payment methods" ON payment_methods
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Transactions Policies
CREATE POLICY "Active users can view transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.status = 'active'
        )
    );

CREATE POLICY "Active admins can update own transactions" ON transactions
    FOR UPDATE 
    USING (
        get_current_user_status() = 'active' 
        AND (
            get_current_user_role() = 'super_admin' 
            OR (
                get_current_user_role() = 'admin' 
                AND recorded_by = auth.uid() 
                AND (
                    now() < created_at + INTERVAL '2 minutes' 
                    OR verification_status = 'flagged_for_edit'
                )
            )
        )
    )
    WITH CHECK (get_current_user_status() = 'active');

CREATE POLICY "Super admins can update any transaction" ON transactions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin' 
            AND profiles.status = 'active'
        )
    );

CREATE POLICY "Admins can delete own transactions within 30s or if flagged" ON transactions
    FOR DELETE USING (
        recorded_by = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.status = 'active'
        )
        AND (
            now() < created_at + INTERVAL '30 seconds' 
            OR verification_status = 'flagged_for_edit'
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- System Settings Policies
CREATE POLICY "Anyone can view system settings" ON system_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage settings" ON system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- ============================================================
-- 9. DEFAULT DATA
-- ============================================================

-- Default payment methods
INSERT INTO payment_methods (name) VALUES ('Cash'), ('G-Cash') ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
