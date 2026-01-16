-- Migration: 20260116_rls_security_audit.sql
-- Description: Enforce Strict RLS on all tables.
-- Step 2 Final Strict Implementation.

-- =========================================================================
-- 1. Helper Function: is_admin()
-- =========================================================================
-- "Admin 判定条件（必ず以下を使用）"
-- We wrap the strict requirement in a SECURITY DEFINER function for performance and security.
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

-- =========================================================================
-- 2. Enable RLS on ALL Tables
-- =========================================================================
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_anomaly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iphones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iphone_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featurephones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featurephone_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.router_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tablets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tablet_usage_history ENABLE ROW LEVEL SECURITY;

-- Optional: Force RLS (Good practice for strict security, ensures no bypass even for owners if configured, though standard Enable is usually sufficient for Supabase users)
-- ALTER TABLE public.logs FORCE ROW LEVEL SECURITY; 
-- ... (Skipping FORCE for now as ENABLE is the requested command)

-- =========================================================================
-- 3. Cleanup Existing Policies (Start Fresh)
-- =========================================================================
-- Dynamically drop ALL policies on the target tables to ensure a clean slate.
-- This prevents "policy already exists" errors and ensures no stale policies remain.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'addresses', 'areas', 'employees', 'logs', 'app_logs', 'audit_logs', 
      'audit_anomaly_rules', 'audit_reports', 'memos', 'device_manuals', 
      'iphones', 'iphone_usage_history', 'featurephones', 'featurephone_usage_history', 
      'routers', 'router_usage_history', 'tablets', 'tablet_usage_history'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =========================================================================
-- 4. Define Policies per Table Group
-- =========================================================================

-- -------------------------------------------------------------------------
-- Group A: Audit & Logs (Strict: Admin SELECT, Service INSERT, No Update/Delete)
-- Tables: logs, app_logs, audit_logs, audit_anomaly_rules, audit_reports
-- -------------------------------------------------------------------------

-- logs
CREATE POLICY "logs_admin_select" ON public.logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "logs_service_insert" ON public.logs FOR INSERT TO service_role WITH CHECK (true);

-- app_logs
CREATE POLICY "app_logs_admin_select" ON public.app_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "app_logs_service_insert" ON public.app_logs FOR INSERT TO service_role WITH CHECK (true);

-- audit_logs
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);

-- audit_reports
CREATE POLICY "audit_reports_admin_select" ON public.audit_reports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_reports_service_insert" ON public.audit_reports FOR INSERT TO service_role WITH CHECK (true);

-- audit_anomaly_rules
CREATE POLICY "audit_rules_admin_select" ON public.audit_anomaly_rules FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_rules_service_insert" ON public.audit_anomaly_rules FOR INSERT TO service_role WITH CHECK (true);


-- -------------------------------------------------------------------------
-- Group B: Master & Assets (Admin ALL, User SELECT)
-- Tables: addresses, areas, iphones, tablets, routers, featurephones, *_usage_history
-- -------------------------------------------------------------------------

-- addresses
CREATE POLICY "addresses_admin_all" ON public.addresses FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "addresses_user_select" ON public.addresses FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- areas
CREATE POLICY "areas_admin_all" ON public.areas FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "areas_user_select" ON public.areas FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- iphones
CREATE POLICY "iphones_admin_all" ON public.iphones FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "iphones_user_select" ON public.iphones FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- iphone_usage_history
CREATE POLICY "iphone_hist_admin_all" ON public.iphone_usage_history FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "iphone_hist_user_select" ON public.iphone_usage_history FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- featurephones
CREATE POLICY "fphones_admin_all" ON public.featurephones FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "fphones_user_select" ON public.featurephones FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- featurephone_usage_history
CREATE POLICY "fphone_hist_admin_all" ON public.featurephone_usage_history FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "fphone_hist_user_select" ON public.featurephone_usage_history FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- routers
CREATE POLICY "routers_admin_all" ON public.routers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "routers_user_select" ON public.routers FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- router_usage_history
CREATE POLICY "router_hist_admin_all" ON public.router_usage_history FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "router_hist_user_select" ON public.router_usage_history FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- tablets
CREATE POLICY "tablets_admin_all" ON public.tablets FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "tablets_user_select" ON public.tablets FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- tablet_usage_history
CREATE POLICY "tablet_hist_admin_all" ON public.tablet_usage_history FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "tablet_hist_user_select" ON public.tablet_usage_history FOR SELECT TO authenticated USING (auth.role() = 'authenticated');


-- -------------------------------------------------------------------------
-- Group C: Employees (Admin ALL, User Self-Select)
-- -------------------------------------------------------------------------
CREATE POLICY "employees_admin_all" ON public.employees FOR ALL TO authenticated USING (public.is_admin());
-- User can only select their own record
CREATE POLICY "employees_user_self_select" ON public.employees FOR SELECT TO authenticated USING (auth_id = auth.uid());


-- -------------------------------------------------------------------------
-- Group D: Memos (Admin ALL, User SELECT)
-- -------------------------------------------------------------------------
CREATE POLICY "memos_admin_all" ON public.memos FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "memos_user_select" ON public.memos FOR SELECT TO authenticated USING (auth.role() = 'authenticated');


-- -------------------------------------------------------------------------
-- Group E: Device Manuals (Admin ALL, Public/User SELECT)
-- -------------------------------------------------------------------------
CREATE POLICY "manuals_admin_all" ON public.device_manuals FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "manuals_public_select" ON public.device_manuals FOR SELECT TO anon USING (true);
CREATE POLICY "manuals_user_select" ON public.device_manuals FOR SELECT TO authenticated USING (true);

