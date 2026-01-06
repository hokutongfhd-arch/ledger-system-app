-- Robust RLS Fix: Use Security Definer Function to check Admin status
-- This avoids reliance on Supabase Auth Metadata (JWT) which can be out of sync.

-- 1. Create a secure function to check if the current user is an admin
-- SECURITY DEFINER allows this function to bypass RLS on the employees table to check permissions.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM employees
    WHERE auth_id = auth.uid()
      AND authority = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing fragile policies
DROP POLICY IF EXISTS "Admins can view all" ON employees;

-- 3. Create new robust policy using the function
CREATE POLICY "Admins can view all"
  ON employees FOR SELECT
  USING (
    is_admin() 
    OR 
    auth_id = auth.uid() -- Keep "Users can view own profile" logic combined or separate? 
                         -- Usually better to keep separate for clarity, but OR is fine here.
  );
  
-- Note: schema.sql had "Users can view own profile" separately. 
-- If we keep that, then this policy can just be USING ( is_admin() ).
-- But to be safe and cover all bases, let's strictly define the Admin one.

CREATE POLICY "Admins can insert"
  ON employees FOR INSERT
  WITH CHECK ( is_admin() );

CREATE POLICY "Admins can update"
  ON employees FOR UPDATE
  USING ( is_admin() );

CREATE POLICY "Admins can delete"
  ON employees FOR DELETE
  USING ( is_admin() );

-- Ensure "Users can view own profile" still exists (if dropped previously, recreate it)
DROP POLICY IF EXISTS "Users can view own profile" ON employees;
CREATE POLICY "Users can view own profile"
  ON employees FOR SELECT
  USING ( auth_id = auth.uid() );
