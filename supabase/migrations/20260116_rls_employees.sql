-- Enable RLS
ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

-- Policy: Admin Full Access
-- Admins can do anything
CREATE POLICY "Enable all access for admins" ON "public"."employees"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Policy: User View Own Profile
-- Users can only view their own record
CREATE POLICY "Enable read access for own profile" ON "public"."employees"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_id
);
