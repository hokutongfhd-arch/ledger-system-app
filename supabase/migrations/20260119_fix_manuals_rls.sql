-- Migration: 20260119_fix_manuals_rls.sql
-- Description: Fix RLS for device_manuals to use employees table instead of JWT metadata

-- 1. Ensure public.is_admin() exists and is correct
-- This function checks the employees table directly, which is more reliable than JWT metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.employees
    WHERE employees.auth_id = auth.uid()
      AND employees.authority = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing policies to avoid conflicts (clean slate for this table)
DROP POLICY IF EXISTS "Enable all access for admins_manuals" ON public.device_manuals;
DROP POLICY IF EXISTS "Enable read access for all users_manuals" ON public.device_manuals;
DROP POLICY IF EXISTS "manuals_admin_all" ON public.device_manuals;
DROP POLICY IF EXISTS "manuals_public_select" ON public.device_manuals;
DROP POLICY IF EXISTS "manuals_user_select" ON public.device_manuals;

-- 3. Create correct policies

-- Admin: Full Access (SELECT, INSERT, UPDATE, DELETE)
-- Checks employees table via is_admin()
CREATE POLICY "manuals_admin_all" ON public.device_manuals
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Authenticated Users: Select Only
CREATE POLICY "manuals_user_select" ON public.device_manuals
  FOR SELECT
  TO authenticated
  USING (true);

-- Public/Anon: Select Only (Optional, keeping consistent with previous state)
CREATE POLICY "manuals_public_select" ON public.device_manuals
  FOR SELECT
  TO anon
  USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.device_manuals ENABLE ROW LEVEL SECURITY;
