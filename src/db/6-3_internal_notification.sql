-- Phase 6-3: Internal Notification & Acknowledgement

-- 1. Add 'is_acknowledged' column (Default false)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS is_acknowledged boolean DEFAULT false;

-- 2. Update Security Trigger to Allow 'is_acknowledged' updates
-- We must allow:
--   1. Archiving (is_archived, archived_at) - From Phase 6-1
--   2. Acknowledgement (is_acknowledged) - Phase 6-3
-- ALL other columns must remain immutable.

CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for modification of Immutable Columns
    -- ANY change to these columns raises an exception
    IF (OLD.id IS DISTINCT FROM NEW.id) OR
       (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) OR
       (OLD.actor_id IS DISTINCT FROM NEW.actor_id) OR
       (OLD.actor_name IS DISTINCT FROM NEW.actor_name) OR
       (OLD.actor_employee_code IS DISTINCT FROM NEW.actor_employee_code) OR
       (OLD.action_type IS DISTINCT FROM NEW.action_type) OR
       (OLD.target_type IS DISTINCT FROM NEW.target_type) OR
       (OLD.target_id IS DISTINCT FROM NEW.target_id) OR
       (OLD.details IS DISTINCT FROM NEW.details) OR
       (OLD.result IS DISTINCT FROM NEW.result) OR
       (OLD.ip_address IS DISTINCT FROM NEW.ip_address) OR
       (OLD.metadata IS DISTINCT FROM NEW.metadata) THEN
        
        RAISE EXCEPTION 'Audit logs are immutable. Only "is_archived", "archived_at", and "is_acknowledged" can be updated.';
    END IF;

    -- If we get here, only permitted columns (status flags) might have changed.
    -- The update is allowed.
    RETURN NEW;
END;
$$;

-- Note: The trigger 'trg_prevent_audit_log_tampering' already exists and uses this function.
-- Replacing the function definition is sufficient.

-- 3. Enable Realtime for audit_logs
-- This allows the Frontend to subscribe to INSERT events.
-- We verify if the table is already in the publication first (optional, but safe to just run add)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
  END IF;
END;
$$;
