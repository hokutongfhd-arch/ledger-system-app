-- Strict Security Measures using Triggers
-- This ensures even the 'postgres' role cannot accidentally DELETE or tamper with logs.

-- 1. Prevent Deletion (Physical Delete is BANNED)
CREATE OR REPLACE FUNCTION prevent_audit_log_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of audit_logs is STRICTLY PROHIBITED to ensure non-repudiation. Use cleanup_old_audit_logs() to archive.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_deletion ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_deletion
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_deletion();


-- 2. Prevent Tampering (UPDATE is restricted to Archiving only)
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow ONLY updating 'is_archived' and 'archived_at'
    -- Check if any other critical column is being changed
    IF (OLD.id IS DISTINCT FROM NEW.id) OR
       (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) OR
       (OLD.actor_id IS DISTINCT FROM NEW.actor_id) OR
       (OLD.actor_name IS DISTINCT FROM NEW.actor_name) OR
       (OLD.action_type IS DISTINCT FROM NEW.action_type) OR
       (OLD.target_type IS DISTINCT FROM NEW.target_type) OR
       (OLD.details IS DISTINCT FROM NEW.details) OR
       (OLD.result IS DISTINCT FROM NEW.result) OR
       (OLD.metadata IS DISTINCT FROM NEW.metadata) THEN
        RAISE EXCEPTION 'Audit logs are immutable. Only archiving status can be updated.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_tampering();

-- Note: RLS policies from previous script still apply for standard roles, 
-- but these triggers act as the final line of defense for admins/superusers.
