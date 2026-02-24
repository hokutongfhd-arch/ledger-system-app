-- Migration: 20260224_add_failed_login_tracking.sql
-- Description: Add failed_login_count to employees and create unknown_login_attempts table.

-- 1. Add failed_login_count to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;

-- 2. Create unknown_login_attempts table for codes not in employees table
CREATE TABLE IF NOT EXISTS public.unknown_login_attempts (
    employee_code TEXT PRIMARY KEY,
    failed_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.unknown_login_attempts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for unknown_login_attempts
-- Only service_role (Admin/Server Actions) should be able to manage this table
DROP POLICY IF EXISTS "unknown_login_attempts_service_all" ON public.unknown_login_attempts;
CREATE POLICY "unknown_login_attempts_service_all" ON public.unknown_login_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin users can select to see the data in audit context if needed later
DROP POLICY IF EXISTS "unknown_login_attempts_admin_select" ON public.unknown_login_attempts;
CREATE POLICY "unknown_login_attempts_admin_select" ON public.unknown_login_attempts
    FOR SELECT TO authenticated USING (public.is_admin());

-- 5. Comments
COMMENT ON COLUMN public.employees.failed_login_count IS '連続ログイン失敗回数';
COMMENT ON TABLE public.unknown_login_attempts IS '未登録の社員コードによるログイン失敗試行の管理テーブル';
