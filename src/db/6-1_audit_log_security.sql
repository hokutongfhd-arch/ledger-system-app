-- 1. Add Archive Columns
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- 2. Revoke Permissions (Prevent Modification by normal roles)
-- Ensure 'authenticated' and 'anon' cannot UPDATE or DELETE
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon;
-- Grant INSERT and SELECT only (Assuming they already have it, but reinforcing)
GRANT INSERT, SELECT ON audit_logs TO authenticated, anon;

-- 3. Row Level Security ensure no one can update/delete even with RLS enabled (Explicit Deny basically implies default RLS logic which denies unless permitted)
-- Assuming RLS is enabled. If we want to strictly enforce "INSERT ONLY" via RLS:
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for INSERT (Allowed)
CREATE POLICY "Enable insert for authenticated users" ON audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policy for SELECT (Allowed for viewing)
CREATE POLICY "Enable read usage for authenticated users" ON audit_logs
    FOR SELECT TO authenticated USING (true);

-- Explicitly NO POLICY for UPDATE / DELETE means they are denied by default for RLS roles.
-- (No action needed as long as we don't create policies for them)

-- 4. Update Cleanup Function (Logical Archiving)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass the REVOKE/RLS restrictions for archiving
AS $$
BEGIN
    -- Update "is_archived" instead of DELETE
    UPDATE audit_logs
    SET is_archived = true,
        archived_at = now()
    WHERE is_archived = false
      AND occurred_at < (now() - (days_to_keep || ' days')::interval)
      AND action_type != 'ANOMALY_DETECTED'; -- Preserve Anomaly logs as active if needed, or archive them too?
      -- Requirement says: "action_type = 'ANOMALY_DETECTED' は除外" (Exclude anomaly from cleanup/archive)

    -- Note: Originally this function might have been deleting. Now it Updates.
END;
$$;
