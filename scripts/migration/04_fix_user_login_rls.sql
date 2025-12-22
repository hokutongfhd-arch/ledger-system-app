-- Allow users to view their own profile based on Auth Metadata (fallback if auth_id is null)
-- This ensures that if the Auth User has 'employee_code' in metadata, they can access their employee record.

CREATE POLICY "Users can view own profile via metadata"
  ON employees FOR SELECT
  USING (
    employee_code = (auth.jwt() -> 'app_metadata' ->> 'employee_code')
  );

-- Also ensure the original policy is enabling (it might already exist, but for clarity)
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
