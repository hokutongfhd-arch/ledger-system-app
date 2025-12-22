-- Add missing SELECT policy for Admins
-- This ensures admins can view ALL employee records, not just their own.

DROP POLICY IF EXISTS "Admins can view all" ON employees;

CREATE POLICY "Admins can view all"
  ON employees FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Verify policies are enabled
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
