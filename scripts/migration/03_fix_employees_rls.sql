-- Allow Admins to INSERT new employees
CREATE POLICY "Admins can insert employees"
  ON employees FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Allow Admins to UPDATE employees
CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Allow Admins to DELETE employees
CREATE POLICY "Admins can delete employees"
  ON employees FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
