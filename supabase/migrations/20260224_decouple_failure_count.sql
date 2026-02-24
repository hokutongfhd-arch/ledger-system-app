-- Migration: 20260224_decouple_failure_count.sql
-- Description: Remove failed_login_count from employees to suppress unnecessary audit logs.
-- The failure count for ALL users will now be managed in unknown_login_attempts table.

-- 1. Remove the column that triggers operation logs
ALTER TABLE public.employees DROP COLUMN IF EXISTS failed_login_count;

-- 2. Ensure unknown_login_attempts is ready for both registered and unregistered users
-- (Already created in previous migration, just ensuring index/comments)
COMMENT ON TABLE public.unknown_login_attempts IS 'ログイン失敗試行の管理テーブル（登録済み・未登録問わず全ての失敗をここでカウントする）';
