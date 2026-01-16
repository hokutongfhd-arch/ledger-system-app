-- Clean Slate: Dynamically drop ALL policies on audit_logs
-- This avoids guessing the policy name.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON "public"."audit_logs"', pol.policyname);
    END LOOP;
END $$;

-- 1. Ensure RLS is Enabled
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Admin View Only (Result: Admin can Read, but cannot Delete/Update via Client)
-- "System logs cannot be modified or deleted from anywhere"
CREATE POLICY "Enable select for admins_audit_logs" ON "public"."audit_logs"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 3. Policy: Allow Logging (INSERT)
-- Users (and Admins) need to write logs from Client.
-- We allow INSERT for all authenticated users.
-- (If Anon logging is needed for login failures, we might need 'anon' too, but let's start with 'authenticated' to be safe against spam)
CREATE POLICY "Enable insert for all users_audit_logs" ON "public"."audit_logs"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- NOTE: No UPDATE or DELETE policies are created.
-- This guarantees Immutability from the Client API.
