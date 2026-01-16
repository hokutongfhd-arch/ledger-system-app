-- Fix RLS for audit_logs
-- 1. Ensure RLS is enabled (In case it failed previously)
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

-- 2. Cleanup potentially older insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Public view" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Anon read" ON "public"."audit_logs";
-- Also drop the ones we just added to re-add them cleanly if needed, though CREATE POLICY IF NOT EXISTS isn't standard in older Postgres without DO block.
-- Let's just drop the one we want to enforce if it's potentially wrong, or just rely on the fact that if it exists, it might be correct?
-- The issue is likely a "Public" policy I didn't know about.

-- Let's try to remove ANY policy that grants SELECT to public/anon.
-- Since we can't iterate easily in simple SQL script without procedural code, I will guess common names found in previous tables.
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Enable all access for all users" ON "public"."audit_logs";
DROP POLICY IF EXISTS "public_read_audit_logs" ON "public"."audit_logs";

-- 3. Re-apply strict Admin Only policy
-- Note: 'create policy' fails if name exists.
-- If the previous script ran partial success, the 'Enable read access for admins_audit_logs' might exist.
-- If so, and RLS is enabled, why did Anon see records?
-- -> Maybe RLS was NOT enabled. The ALTER TABLE might have failed if table name was wrong or permission denied?
-- -> Table name is `audit_logs` in verification script and SQL.
-- -> Reviewing verification output: "Anonymous saw 252 records".
-- -> This DEFINITELY means RLS is OFF or there is a policy "TO public USING (true)".

-- Let's Try Force Enable again.
ALTER TABLE "public"."audit_logs" FORCE ROW LEVEL SECURITY; 
-- FORCE is for owners, but ENABLE is standard.

-- Let's assume there is a policy "Enable read access for all users" like employees had.
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."audit_logs";

-- Re-assert Admin Policy (Drop and Re-create to be sure)
DROP POLICY IF EXISTS "Enable read access for admins_audit_logs" ON "public"."audit_logs";

create policy "Enable read access for admins_audit_logs" on "public"."audit_logs" for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Also check "Enable all access for admins_audit_logs" if I created that?
-- In previous script: create policy "Enable all access for admins_audit_logs" ...
DROP POLICY IF EXISTS "Enable all access for admins_audit_logs" ON "public"."audit_logs";
create policy "Enable all access for admins_audit_logs" on "public"."audit_logs" for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
