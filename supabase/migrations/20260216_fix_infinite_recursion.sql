-- Migration: 20260216_fix_infinite_recursion.sql
-- Description: Fix infinite recursion in RLS by updating is_admin() to use JWT claims instead of table query.

-- Redefine is_admin to use JWT metadata
-- This avoids querying the 'employees' table, which itself has an RLS policy calling 'is_admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the 'role' in app_metadata is 'admin'
  -- We use COALESCE to handle cases where metadata might be missing
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
